'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'
import Avatar from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'

export default function Nav() {
  const router = useRouter()
  const supabase = createClient()

  const [user, setUser] = useState<{
    id: string
    email: string | null
    name: string | null
    avatar: string | null
  } | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)

  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const [profileRes, walletRes] = await Promise.all([
            supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).maybeSingle(),
            supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
          ])
          setUser({
            id: session.user.id,
            email: session.user.email ?? null,
            name: profileRes.data?.full_name ?? null,
            avatar: profileRes.data?.avatar_url ?? null,
          })
          setWalletBalance(walletRes.data?.balance ?? null)
        }
      } finally {
        setLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const [profileRes, walletRes] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).maybeSingle(),
          supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
        ])
        setUser({
          id: session.user.id,
          email: session.user.email ?? null,
          name: profileRes.data?.full_name ?? null,
          avatar: profileRes.data?.avatar_url ?? null,
        })
        setWalletBalance(walletRes.data?.balance ?? null)
      } else {
        setUser(null)
        setWalletBalance(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '58px',
      background: '#0f172a',
      borderBottom: '1px solid #1e293b',
      zIndex: 100,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      gap: '12px',
    }}>

      {/* Profile photo — top left */}
      {!loading && user && (
        <div ref={profileRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setProfileOpen(v => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '3px',
              borderRadius: '50%',
              outline: 'none',
            }}
            aria-label="Profile menu"
          >
            <Avatar url={user.avatar} name={user.name} email={user.email} size={32} />
          </button>

          {profileOpen && (
            <div style={{
              position: 'absolute',
              left: 0,
              top: '44px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              minWidth: '220px',
              overflow: 'hidden',
              zIndex: 200,
            }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Avatar url={user.avatar} name={user.name} email={user.email} size={38} />
                <div style={{ overflow: 'hidden', flex: 1 }}>
                  <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.name ?? 'Your Profile'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                </div>
              </div>
              {[
                { href: '/profile', label: '👤 Your Profile' },
                { href: '/create', label: '✏️ Create Post' },
                { href: '/dashboard', label: '📊 Dashboard' },
                { href: '/wallet', label: '💎 Wallet' },
                { href: '/connections', label: '🔗 Connections' },
                { href: '/settings', label: '⚙️ Settings' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setProfileOpen(false)}
                  style={{
                    display: 'block',
                    padding: '10px 16px',
                    fontSize: '13px',
                    color: '#cbd5e1',
                    textDecoration: 'none',
                  }}
                >
                  {label}
                </Link>
              ))}
              <div style={{ borderTop: '1px solid #334155' }}>
                <button
                  onClick={handleSignOut}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 16px',
                    fontSize: '13px',
                    color: '#f87171',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
        <span style={{
          background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
          borderRadius: '8px',
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '13px',
          color: '#fff',
          flexShrink: 0,
        }}>FT</span>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>FreeTrust</span>
      </Link>

      {/* Spacer — search bar sits BELOW the nav bar (in layout), so just push right items */}
      <div style={{ flex: 1 }} />

      {/* Right side — trust balance + notifications */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {user && walletBalance !== null && (
          <Link href="/wallet" style={{
            display: 'flex',
            alignItems: 'center',
            padding: '5px 10px',
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#38bdf8',
            textDecoration: 'none',
          }}>
            ₮{walletBalance.toFixed(0)}
          </Link>
        )}

        {/* Notifications bell — top right */}
        {user && <NotificationBell />}

        {/* Unauthenticated */}
        {!loading && !user && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link href="/auth/signin" style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#94a3b8',
              textDecoration: 'none',
              border: '1px solid #334155',
            }}>Sign in</Link>
            <Link href="/auth/signup" style={{
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              textDecoration: 'none',
              background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            }}>Sign up</Link>
          </div>
        )}

        {loading && (
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e293b' }} />
        )}
      </div>
    </header>
  )
}
