import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ code: string }>
}

export default async function InvitePage({ params }: PageProps) {
  const { code } = await params
  const normalizedCode = code.toUpperCase().trim()

  // Look up the referring user
  const admin = createAdminClient()
  const { data: referrer } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('referral_code', normalizedCode)
    .maybeSingle()

  if (!referrer) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui', padding: '2rem' }}>
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.5rem' }}>Invalid invite link</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>This referral code doesn&rsquo;t exist. Ask your friend to resend their link, or sign up without a referral.</p>
          <Link href="/register" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#0f172a', fontWeight: 700, padding: '0.75rem 1.75rem', borderRadius: 10, textDecoration: 'none' }}>Sign up</Link>
        </div>
      </div>
    )
  }

  // Store the referral code in a cookie that survives the signup flow
  const cookieStore = await cookies()
  cookieStore.set('ft_ref', normalizedCode, {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })

  // Check if already signed in — if so, just redirect to register where the
  // referral will be linked on next login, or we could directly redirect home.
  // For clarity: always send to /register with the code query param so the
  // register page can display who invited them.
  const params_qs = new URLSearchParams({ ref: normalizedCode })
  redirect(`/register?${params_qs.toString()}`)
}
