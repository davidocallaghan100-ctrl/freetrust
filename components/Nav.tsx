'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'
import CreateMenu from '@/components/CreateMenu'
import { createClient } from '@/lib/supabase/client'

function getInitials(email: string | null | undefined, name: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'ME'
}

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
  const [query, setQuery] = useState('')

  const profileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const [profileRes, walletRes] = await Promise.all([
            supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', session.user.id)
              .maybeSingle(),
            supabase
              .from('trust_balances')
              .select('balance')
              .eq('user_id', session.user.id)
              .maybeSingle(),
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
          supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', session.user.id)
            .maybeSingle(),
          supabase
            .from('trust_balances')
            .select('balance')
            .eq('user_id', session.user.id)
            .maybeSingle(),
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?q=${encodeURIComponent(q)}`)
    setQuery('')
  }

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
      {/* Logo */}
      <Link href="/" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
        flexShrink: 0,
      }}>
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
        <span style={{
          color: '#f1f5f9',
          fontWeight: 700,
          fontSize: '15px',
          letterSpacing: '-0.3px',
        }}>FreeTrust</span>
      </Link>

      {/* Search — centered, max 400px */}
      <form onSubmit={handleSearch} style={{ flex: 1, maxWidth: '400px', margin: '0 auto' }}>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search FreeTrust…"
          style={{
            width: '100%',
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            padding: '7px 14px',
            fontSize: '13px',
            color: '#f1f5f9',
            outline: 'none',
          }}
        />
      </form>

      {/* Right side */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexShrink: 0,
        marginLeft: 'auto',
      }}>
        {user && (
          <>
            {walletBalance !== null && (
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
            <NotificationBell />
            <CreateMenu />
          </>
        )}

        {loading ? (
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e293b' }} />
        ) : user ? (
          <div ref={profileRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
            >
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt="avatar"
                  style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}>
                  {getInitials(user.email, user.name)}
                </div>
              )}
              <span style={{ fontSize: '10px', color: '#64748b' }}>▾</span>
            </button>

            {profileOpen && (
              <div style={{
                position: 'absolute',
                right: 0,
                top: '44px',
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '10px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                minWidth: '200px',
                overflow: 'hidden',
                zIndex: 200,
              }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Signed in as</div>
                  <div style={{
                    fontSize: '13px',
                    color: '#f1f5f9',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>{user.email}</div>
                </div>
                {[
                  { href: '/profile', label: '👤 Your Profile' },
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
        ) : (
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
      </div>
    </header>
  )
}
