'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'
import Avatar from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'

const DRAWER_SECTIONS = [
  {
    label: 'DIGITAL',
    links: [
      { href: '/wallet',    label: 'Trust Wallet',          icon: '💎' },
      { href: '/feed',      label: 'Newsfeed',               icon: '📰' },
      { href: '/products',  label: 'Product Marketplace',    icon: '📦' },
      { href: '/services',  label: 'Services Marketplace',   icon: '🛠' },
      { href: '/browse',    label: 'Directory',              icon: '🔍' },
    ],
  },
  {
    label: 'SOCIAL',
    links: [
      { href: '/community', label: 'Community',  icon: '👥' },
      { href: '/articles',  label: 'Articles',   icon: '✍️' },
      { href: '/jobs',      label: 'Jobs',        icon: '💼' },
    ],
  },
  {
    label: 'EVENTS',
    links: [
      { href: '/events',        label: 'Directory',  icon: '📅' },
      { href: '/events/create', label: 'Add Event',  icon: '➕' },
    ],
  },
  {
    label: 'PLANET',
    links: [
      { href: '/impact', label: 'Impact', icon: '🌍' },
    ],
  },
]

export default function Nav() {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [user, setUser] = useState<{
    id: string; email: string | null; name: string | null; avatar: string | null
  } | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)

  const profileRef = useRef<HTMLDivElement>(null)

  /* ── auth ── */
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const [profileRes, walletRes] = await Promise.all([
            supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).maybeSingle(),
            supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
          ])
          setUser({ id: session.user.id, email: session.user.email ?? null, name: profileRes.data?.full_name ?? null, avatar: profileRes.data?.avatar_url ?? null })
          setWalletBalance(walletRes.data?.balance ?? null)
        }
      } finally { setLoading(false) }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        const [profileRes, walletRes] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url').eq('id', session.user.id).maybeSingle(),
          supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
        ])
        setUser({ id: session.user.id, email: session.user.email ?? null, name: profileRes.data?.full_name ?? null, avatar: profileRes.data?.avatar_url ?? null })
        setWalletBalance(walletRes.data?.balance ?? null)
      } else { setUser(null); setWalletBalance(null) }
      setLoading(false)
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── close profile dropdown on outside click ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  /* ── close drawer on route change ── */
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  /* ── lock body scroll when drawer open ── */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const handleSignOut = async () => {
    setDrawerOpen(false)
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* ── Top bar ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '58px',
        background: '#0f172a', borderBottom: '1px solid #1e293b',
        zIndex: 100, display: 'flex', alignItems: 'center', padding: '0 16px', gap: '12px',
      }}>

        {/* Profile avatar — top left */}
        {!loading && user && (
          <div ref={profileRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setProfileOpen(v => !v)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '50%', outline: 'none' }} aria-label="Profile menu">
              <Avatar url={user.avatar} name={user.name} email={user.email} size={32} />
            </button>
            {profileOpen && (
              <div style={{ position: 'absolute', left: 0, top: '44px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', minWidth: '220px', overflow: 'hidden', zIndex: 200 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar url={user.avatar} name={user.name} email={user.email} size={38} />
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? 'Your Profile'}</div>
                    <div style={{ fontSize: '11px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                  </div>
                </div>
                {[
                  { href: '/profile',     label: '👤 Your Profile' },
                  { href: '/create',      label: '✏️ Create Post'  },
                  { href: '/dashboard',   label: '📊 Dashboard'    },
                  { href: '/wallet',      label: '💎 Wallet'       },
                  { href: '/connections', label: '🔗 Connections'  },
                  { href: '/settings',    label: '⚙️ Settings'     },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} onClick={() => setProfileOpen(false)} style={{ display: 'block', padding: '10px 16px', fontSize: '13px', color: '#cbd5e1', textDecoration: 'none' }}>
                    {label}
                  </Link>
                ))}
                <div style={{ borderTop: '1px solid #334155' }}>
                  <button onClick={handleSignOut} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: '13px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ background: 'linear-gradient(135deg, #38bdf8, #818cf8)', borderRadius: '8px', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: '#fff', flexShrink: 0 }}>FT</span>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>FreeTrust</span>
        </Link>

        <div style={{ flex: 1 }} />

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {user && walletBalance !== null && (
            <Link href="/wallet" style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#38bdf8', textDecoration: 'none' }}>
              ₮{walletBalance.toFixed(0)}
            </Link>
          )}
          {user && <NotificationBell />}
          {!loading && !user && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link href="/auth/signin" style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, color: '#94a3b8', textDecoration: 'none', border: '1px solid #334155' }}>Sign in</Link>
              <Link href="/auth/signup" style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #38bdf8, #818cf8)' }}>Sign up</Link>
            </div>
          )}
          {loading && <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e293b' }} />}

          {/* ── Hamburger button ── */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            aria-label="Open menu"
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '5px', width: '36px', height: '36px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px', flexShrink: 0 }}
          >
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#94a3b8', borderRadius: '2px', transition: 'all 0.25s ease', transform: drawerOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#94a3b8', borderRadius: '2px', transition: 'all 0.25s ease', opacity: drawerOpen ? 0 : 1, transform: drawerOpen ? 'scaleX(0)' : 'none' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#94a3b8', borderRadius: '2px', transition: 'all 0.25s ease', transform: drawerOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </header>

      {/* ── Drawer overlay ── */}
      <div
        onClick={() => setDrawerOpen(false)}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 998,
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'all' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* ── Drawer panel ── */}
      <nav style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '280px',
        background: '#0d1627',
        borderLeft: '1px solid #1e293b',
        zIndex: 999,
        overflowY: 'auto',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: drawerOpen ? '-8px 0 40px rgba(0,0,0,0.5)' : 'none',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Drawer header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1e293b', height: '58px', flexShrink: 0 }}>
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>Menu</span>
          <button onClick={() => setDrawerOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#1e293b', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }} aria-label="Close menu">
            ✕
          </button>
        </div>

        {/* User info strip (if logged in) */}
        {user && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar url={user.avatar} name={user.name} email={user.email} size={40} />
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? 'Your Profile'}</div>
              <div style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            </div>
          </div>
        )}

        {/* Nav sections */}
        <div style={{ padding: '12px 0', flex: 1 }}>
          {DRAWER_SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom: '8px' }}>
              <div style={{ padding: '8px 20px 4px', fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {section.label}
              </div>
              {section.links.map(({ href, label, icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 20px',
                      fontSize: '14px',
                      fontWeight: active ? 600 : 400,
                      color: active ? '#38bdf8' : '#cbd5e1',
                      textDecoration: 'none',
                      background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                      borderLeft: active ? '3px solid #38bdf8' : '3px solid transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
                    {label}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Account section at bottom */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '8px', paddingBottom: '16px' }}>
          <div style={{ padding: '8px 20px 4px', fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            ACCOUNT
          </div>
          {[
            { href: '/profile',  label: 'Profile',  icon: '👤' },
            { href: '/settings', label: 'Settings', icon: '⚙️' },
          ].map(({ href, label, icon }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px',
                  fontSize: '14px', fontWeight: active ? 600 : 400,
                  color: active ? '#38bdf8' : '#cbd5e1', textDecoration: 'none',
                  background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                  borderLeft: active ? '3px solid #38bdf8' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
                {label}
              </Link>
            )
          })}
          {user ? (
            <button
              onClick={handleSignOut}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px',
                width: '100%', textAlign: 'left', fontSize: '14px', color: '#f87171',
                background: 'none', border: 'none', borderLeft: '3px solid transparent',
                cursor: 'pointer', transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '16px', lineHeight: 1 }}>🚪</span>
              Sign Out
            </button>
          ) : (
            <Link href="/auth/signin" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', fontSize: '14px', color: '#38bdf8', textDecoration: 'none', borderLeft: '3px solid transparent' }}>
              <span style={{ fontSize: '16px', lineHeight: 1 }}>🔑</span>
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </>
  )
}
