import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/resend'
import { sendEmail } from '@/lib/email/send'

// This route handles:
// 1. Email confirmation links
// 2. OAuth provider callbacks (Google, etc.)
// Supabase redirects here after authentication
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

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
          // Determine "new user" by whether a signup bonus has already been issued.
          // Time-based checks (e.g. 60s) fail for email signups — users typically
          // take 1–5+ minutes to confirm their email, blowing past any short window.
          const { data: existingBalance } = await supabase
            .from('trust_balances')
            .select('user_id')
            .eq('user_id', user.id)
            .maybeSingle()
          const isNewUser = !existingBalance

          if (isNewUser) {
            // Sync Google OAuth metadata (name, avatar) into profiles
            try {
              const meta = user.user_metadata ?? {}
              const fullName = meta.full_name ?? meta.name ?? null
              const avatarUrl = meta.avatar_url ?? meta.picture ?? null
              if (fullName || avatarUrl) {
                await supabase.from('profiles').update({
                  ...(fullName ? { full_name: fullName } : {}),
                  ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
                }).eq('id', user.id)
              }
            } catch (err) {
              console.error('[auth/callback] Profile metadata sync error:', err)
            }

            // Award ₮25 founding member signup bonus (idempotent — only reached when
            // no trust_balances row exists yet, confirmed by the isNewUser check above)
            try {
              const { error: rpcError } = await supabase.rpc('issue_trust', {
                p_user_id: user.id,
                p_amount: 25,
                p_type: 'signup_bonus',
                p_ref: null,
                p_desc: 'Welcome to FreeTrust! Founding Member bonus.',
              })
              if (rpcError) {
                // Fallback: best-effort ledger insert (table may not exist yet — that's OK)
                await supabase.from('trust_ledger').insert({
                  user_id: user.id,
                  amount: 25,
                  type: 'signup_bonus',
                  description: 'Welcome to FreeTrust! Founding Member bonus.',
                })
                // Always create the balance row — this is the source of truth the UI reads
                await supabase.from('trust_balances').insert(
                  { user_id: user.id, balance: 25, lifetime: 25 }
                )
              }
            } catch {
              console.error('[auth/callback] Trust bonus error — continuing')
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

            // Redirect new users to onboarding
            return NextResponse.redirect(`${origin}/onboarding`)
          }
        }
      } catch (err) {
        console.error('[auth/callback] Post-auth processing error:', err)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession error:', error)
  }

  // Return to error page or login
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
