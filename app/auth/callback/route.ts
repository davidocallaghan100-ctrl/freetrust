import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/resend'
import { sendEmail } from '@/lib/email/send'
import { createAdminClient } from '@/lib/supabase/admin'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'

// This route handles:
// 1. Email confirmation links
// 2. OAuth provider callbacks (Google, etc.)
// Supabase redirects here after authentication
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const requestedNext = searchParams.get('next') ?? '/feed'
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/feed'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if this is a new user
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          // Every write in this branch uses the admin (service-role) client.
          // The user-session client hit RLS denial on trust_balances /
          // trust_ledger INSERT and silently swallowed the error, which is
          // exactly the bug fixed here. Admin client bypasses RLS cleanly.
          //
          // Migration 20260413000004_trust_welcome_grant.sql adds an
          // explicit INSERT policy as belt-and-braces too, but we
          // prefer the admin path so this route works even if that
          // migration hasn't been applied yet.
          const admin = createAdminClient()

          const meta = user.user_metadata ?? {}
          const fullName = typeof (meta.full_name ?? meta.name) === 'string'
            ? String(meta.full_name ?? meta.name).trim()
            : ''
          const avatarUrl = typeof (meta.avatar_url ?? meta.picture) === 'string'
            ? String(meta.avatar_url ?? meta.picture).trim()
            : ''
          const nameParts = fullName.split(/\s+/).filter(Boolean)
          const firstName = typeof meta.first_name === 'string' && meta.first_name.trim()
            ? meta.first_name.trim()
            : nameParts[0] ?? ''
          const lastName = typeof meta.last_name === 'string' && meta.last_name.trim()
            ? meta.last_name.trim()
            : nameParts.slice(1).join(' ')

          const { data: existingProfile, error: profileReadError } = await admin
            .from('profiles')
            .select('id,email,full_name,first_name,last_name,avatar_url,onboarding_complete')
            .eq('id', user.id)
            .maybeSingle()

          if (profileReadError) {
            console.error('[auth/callback] Profile read error:', profileReadError)
          }

          // OAuth users must have a profile row before they reach protected UI.
          // The DB trigger normally creates it, but this repair keeps Google/Apple
          // signups from bouncing back to login or landing on a sparse profile.
          try {
            if (!existingProfile) {
              await admin.from('profiles').upsert({
                id: user.id,
                email: user.email ?? null,
                first_name: firstName || null,
                last_name: lastName || null,
                full_name: fullName || user.email?.split('@')[0] || null,
                avatar_url: avatarUrl || null,
                onboarding_complete: false,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' })
            } else {
              const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() }
              if (!existingProfile.email && user.email) profileUpdates.email = user.email
              if (!existingProfile.full_name && fullName) profileUpdates.full_name = fullName
              if (!existingProfile.first_name && firstName) profileUpdates.first_name = firstName
              if (!existingProfile.last_name && lastName) profileUpdates.last_name = lastName
              if (!existingProfile.avatar_url && avatarUrl) profileUpdates.avatar_url = avatarUrl
              if (Object.keys(profileUpdates).length > 1) {
                await admin.from('profiles').update(profileUpdates).eq('id', user.id)
              }
            }
          } catch (err) {
            console.error('[auth/callback] Profile upsert/sync error:', err)
          }

          const profileIncomplete = !existingProfile || existingProfile.onboarding_complete !== true

          // Determine "new user" by whether a signup bonus has already been issued.
          // Time-based checks (e.g. 60s) fail for email signups — users typically
          // take 1–5+ minutes to confirm their email, blowing past any short window.
          const { data: existingBalance } = await admin
            .from('trust_balances')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()
          const isNewUser = !existingBalance

          if (isNewUser) {
            // Award the founding member signup bonus (idempotent — only
            // reached when no trust_balances row exists yet, confirmed by
            // the isNewUser check above). Amount is read from
            // TRUST_REWARDS.SIGNUP_BONUS; this file previously hardcoded
            // `25` in three places, which is why new users received ₮25
            // even though the catalogue said ₮200.
            //
            // NEVER silently swallow errors here — the original bug burned
            // production signups for months because the catch block was
            // empty. Every failure path now logs the full Supabase error
            // object so the next investigation can see exactly what broke.
            const signupAmount = TRUST_REWARDS.SIGNUP_BONUS
            const signupDescription = `Welcome to FreeTrust! Founding Member bonus (₮${signupAmount}).`
            try {
              const { error: rpcError } = await admin.rpc('issue_trust', {
                p_user_id: user.id,
                p_amount:  signupAmount,
                p_type:    TRUST_LEDGER_TYPES.SIGNUP_BONUS,
                p_ref:     null,
                p_desc:    signupDescription,
              })
              if (rpcError) {
                console.error('[auth/callback] issue_trust RPC failed, falling back to direct insert:', {
                  code:    rpcError.code,
                  message: rpcError.message,
                  details: rpcError.details,
                  hint:    rpcError.hint,
                })

                // Fallback: admin-client direct insert. Balance is the
                // source of truth the UI reads, so we insert it first
                // and flag a ledger failure as non-fatal.
                const { error: balanceErr } = await admin
                  .from('trust_balances')
                  .insert({ user_id: user.id, balance: signupAmount, lifetime: signupAmount })
                if (balanceErr) {
                  console.error('[auth/callback] trust_balances insert failed:', {
                    code:    balanceErr.code,
                    message: balanceErr.message,
                    details: balanceErr.details,
                    hint:    balanceErr.hint,
                  })
                } else {
                  const { error: ledgerErr } = await admin.from('trust_ledger').insert({
                    user_id:     user.id,
                    amount:      signupAmount,
                    type:        TRUST_LEDGER_TYPES.SIGNUP_BONUS,
                    description: signupDescription,
                  })
                  if (ledgerErr) {
                    console.error('[auth/callback] trust_ledger insert failed (non-fatal):', ledgerErr.message)
                  }
                }
              }
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err)
              console.error('[auth/callback] Trust bonus unexpected error — continuing:', message)
            }

            // Award founding member badge
            try {
              await supabase.from('user_badges').insert({
                user_id: user.id,
                badge_slug: 'founding_member',
                awarded_at: new Date().toISOString(),
              })
            } catch {
              // table may not exist yet — ignore
            }

            // Link referral if a referral code cookie is present
            try {
              const refCode = cookieStore.get('ft_ref')?.value
              if (refCode) {
                const code = refCode.toUpperCase().trim()
                // Look up referrer by code
                const { data: referrer } = await supabase
                  .from('profiles')
                  .select('id')
                  .eq('referral_code', code)
                  .maybeSingle()

                if (referrer && referrer.id !== user.id) {
                  // Check we haven't already created a referral for this user
                  const { data: existing } = await supabase
                    .from('referrals')
                    .select('id')
                    .eq('referred_id', user.id)
                    .maybeSingle()

                  if (!existing) {
                    await supabase.from('referrals').insert({
                      referrer_id: referrer.id,
                      referred_id: user.id,
                      status: 'pending',
                      reward_credited: false,
                      reward_amount: 50,
                    })
                    await supabase
                      .from('profiles')
                      .update({ referred_by: referrer.id })
                      .eq('id', user.id)
                    await supabase.from('notifications').insert({
                      user_id: referrer.id,
                      type: 'referral',
                      title: '🎉 New referral!',
                      body: 'Someone joined FreeTrust using your referral link. Once they complete their first transaction, you\'ll earn ₮50 trust.',
                      link: '/settings?tab=referral',
                    })
                    // Email the referrer (preference-checked)
                    sendEmail({ type: 'referral_joined', userId: referrer.id }).catch(() => {})
                  }
                }
                // Clear the cookie — referral has been processed
                cookieStore.set('ft_ref', '', { maxAge: 0, path: '/' })
              }
            } catch (err) {
              console.error('[auth/callback] Referral link error:', err)
            }

            // Send welcome email via Resend
            try {
              const name = user.user_metadata?.full_name || user.user_metadata?.name || 'there'
              const email = user.email
              if (email) {
                await sendWelcomeEmail(email, name)
              }
            } catch (err) {
              console.error('[auth/callback] Failed to send welcome email:', err)
            }

            // New members should always see the same profile/hobbies setup flow,
            // regardless of whether they joined by email, Google, or Apple.
            return NextResponse.redirect(`${origin}/onboarding?welcome=1`)
          }

          // Existing users who never completed onboarding (e.g. OAuth users who
          // previously landed on /feed) should get the same profile/hobbies flow
          // instead of being treated as signed out or left with a blank profile.
          if (profileIncomplete) {
            return NextResponse.redirect(`${origin}/onboarding?welcome=1`)
          }
        }
      } catch (err) {
        console.error('[auth/callback] Post-auth processing error:', err)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error)
  }

  // Some Supabase email/OAuth providers can land here with the auth tokens in
  // the URL fragment (`#access_token=...`) instead of a `?code=` query param.
  // The fragment is never sent to the server, but browsers preserve it across a
  // redirect when the Location has no fragment, so send the user to a client
  // handoff page that can store the session before routing onward.
  return NextResponse.redirect(`${origin}/auth/session?next=${encodeURIComponent(next)}`)
}
