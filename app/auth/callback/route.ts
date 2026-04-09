import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/resend'

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
      // Check if this is a brand new user (created within last 60 seconds)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const createdAt = new Date(user.created_at).getTime()
          const isNewUser = Date.now() - createdAt < 60_000

          if (isNewUser) {
            // Award ₮25 founding member signup bonus (idempotent)
            try {
              const { error: rpcError } = await supabase.rpc('issue_trust', {
                p_user_id: user.id,
                p_amount: 25,
                p_type: 'signup_bonus',
                p_ref: null,
                p_desc: 'Welcome to FreeTrust! Founding Member bonus.',
              })
              if (rpcError) {
                // Fallback: direct insert if RPC not available
                await supabase.from('trust_ledger').insert({
                  user_id: user.id,
                  amount: 25,
                  type: 'signup_bonus',
                  description: 'Welcome to FreeTrust! Founding Member bonus.',
                })
                await supabase.from('trust_balances').upsert(
                  { user_id: user.id, balance: 25, lifetime: 25 },
                  { onConflict: 'user_id' }
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
