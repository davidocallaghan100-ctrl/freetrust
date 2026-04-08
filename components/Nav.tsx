'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'
import { createClient } from '@/lib/supabase/client'

const links = [
  { href: '/browse', label: 'Browse' },
  { href: '/feed', label: 'Feed' },
  { href: '/services', label: 'Services' },
  { href: '/products', label: 'Products' },
  { href: '/events', label: 'Events' },
  { href: '/community', label: 'Community' },
  { href: '/articles', label: 'Articles' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/organisations', label: 'Orgs' },
  { href: '/impact', label: 'Impact' },
  { href: '/dashboard', label: 'Dashboard' },
]

function getInitials(email: string | null | undefined, name: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'ME'
}

function truncateEmail(email: string | null | undefined): string {
  if (!email) return ''
  if (email.length <= 20) return email
  const [local, domain] = email.split('@')
  if (!domain) return email.slice(0, 20) + '…'
  const shortLocal = local.length > 8 ? local.slice(0, 8) + '…' : local
  return `${shortLocal}@${domain}`
}

export default function Nav() {
  const path = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<{ email: string | null; name: string | null } | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  // Close mobile menu on route change
  useEffect(() => { setOpen(false) }, [path])

  // Fetch auth state
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email ?? null,
          name: (data.user.user_metadata?.full_name as string) ?? null,
        })
      } else {
        setUser(null)
      }
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          email: session.user.email ?? null,
          name: (session.user.user_metadata?.full_name as string) ?? null,
        })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const isActive = (href: string) =>
    href === '/' ? path === href : path.startsWith(href)

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
    router.push('/')
  }

  const initials = user ? getInitials(user.email, user.name) : ''

  return (
    <>
      <style>{`
        .ft-nav {
          background: rgba(15,23,42,0.97);
          border-bottom: 1px solid rgba(56,189,248,0.15);
          position: sticky;
          top: 0;
          z-index: 1000;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .ft-nav-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 1.25rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 58px;
          gap: 0.75rem;
        }
        .ft-nav-logo {
          font-size: 1.2rem;
          font-weight: 900;
          color: #38bdf8;
          text-decoration: none;
          letter-spacing: -0.5px;
          flex-shrink: 0;
          z-index: 1001;
        }
        .ft-nav-logo span { color: #cbd5e1; }

        /* Desktop links */
        .ft-nav-links {
          display: flex;
          gap: 0.1rem;
          align-items: center;
          overflow: hidden;
          flex: 1;
        }
        .ft-nav-link {
          padding: 0.3rem 0.55rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 500;
          text-decoration: none;
          color: #94a3b8;
          white-space: nowrap;
          transition: all 0.15s;
          border: 1px solid transparent;
        }
        .ft-nav-link:hover { color: #f1f5f9; background: rgba(56,189,248,0.06); }
        .ft-nav-link.active {
          color: #38bdf8;
          background: rgba(56,189,248,0.1);
          border-color: rgba(56,189,248,0.25);
          font-weight: 600;
        }

        /* Desktop auth buttons */
        .ft-nav-auth {
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
          align-items: center;
        }
        .ft-nav-signin {
          padding: 0.35rem 0.9rem;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 500;
          text-decoration: none;
          color: #94a3b8;
          border: 1px solid rgba(148,163,184,0.2);
          transition: all 0.15s;
          white-space: nowrap;
        }
        .ft-nav-signin:hover { color: #f1f5f9; border-color: rgba(148,163,184,0.4); }
        .ft-nav-join {
          padding: 0.35rem 0.9rem;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 700;
          text-decoration: none;
          color: #0f172a;
          background: #38bdf8;
          transition: opacity 0.15s;
          white-space: nowrap;
        }
        .ft-nav-join:hover { opacity: 0.88; }
        .ft-nav-search-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 6px;
          color: #94a3b8;
          border: 1px solid rgba(148,163,184,0.2);
          text-decoration: none;
          transition: all 0.15s;
        }
        .ft-nav-search-btn:hover { color: #38bdf8; border-color: rgba(56,189,248,0.4); background: rgba(56,189,248,0.06); }

        /* User avatar in nav */
        .ft-nav-user {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .ft-nav-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 700;
          color: #0f172a;
          text-decoration: none;
          flex-shrink: 0;
          border: 2px solid rgba(56,189,248,0.3);
          transition: border-color 0.15s;
        }
        .ft-nav-avatar:hover { border-color: #38bdf8; }
        .ft-nav-email {
          font-size: 0.75rem;
          color: #94a3b8;
          white-space: nowrap;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ft-nav-signout {
          padding: 0.3rem 0.7rem;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 500;
          color: #64748b;
          border: 1px solid rgba(148,163,184,0.15);
          background: transparent;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .ft-nav-signout:hover { color: #f1f5f9; border-color: rgba(148,163,184,0.35); }

        /* Hamburger button — hidden on desktop */
        .ft-burger {
          display: none;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 5px;
          width: 40px;
          height: 40px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 4px;
          z-index: 1001;
          flex-shrink: 0;
          border-radius: 6px;
          transition: background 0.15s;
        }
        .ft-burger:hover { background: rgba(56,189,248,0.08); }
        .ft-burger-bar {
          display: block;
          width: 22px;
          height: 2px;
          background: #cbd5e1;
          border-radius: 2px;
          transition: all 0.25s ease;
          transform-origin: center;
        }
        .ft-burger.is-open .ft-burger-bar:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .ft-burger.is-open .ft-burger-bar:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .ft-burger.is-open .ft-burger-bar:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

        /* Mobile drawer — hidden on desktop */
        .ft-mobile-menu {
          display: none;
          position: fixed;
          top: 58px;
          left: 0;
          right: 0;
          bottom: 0;
          background: #0f172a;
          border-top: 1px solid rgba(56,189,248,0.15);
          z-index: 999;
          overflow-y: auto;
          transform: translateX(100%);
          transition: transform 0.28s ease;
        }
        .ft-mobile-menu.is-open {
          transform: translateX(0);
        }
        .ft-mobile-inner {
          display: flex;
          flex-direction: column;
          padding: 1rem 1.25rem 2rem;
          gap: 0.35rem;
        }
        .ft-mobile-link {
          display: flex;
          align-items: center;
          padding: 0.85rem 1rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          text-decoration: none;
          color: #94a3b8;
          border: 1px solid transparent;
          transition: all 0.15s;
        }
        .ft-mobile-link:hover {
          background: rgba(56,189,248,0.06);
          color: #f1f5f9;
          border-color: rgba(56,189,248,0.12);
        }
        .ft-mobile-link.active {
          color: #38bdf8;
          background: rgba(56,189,248,0.08);
          border-color: rgba(56,189,248,0.25);
          font-weight: 700;
        }
        .ft-mobile-divider {
          height: 1px;
          background: rgba(56,189,248,0.08);
          margin: 0.5rem 0;
        }
        .ft-mobile-user {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(56,189,248,0.05);
          border: 1px solid rgba(56,189,248,0.12);
          border-radius: 10px;
          margin-bottom: 0.5rem;
        }
        .ft-mobile-user-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #38bdf8, #0284c7);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
          color: #0f172a;
          flex-shrink: 0;
        }
        .ft-mobile-user-info { flex: 1; min-width: 0; }
        .ft-mobile-user-name { font-size: 0.9rem; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-mobile-user-email { font-size: 0.75rem; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ft-mobile-auth {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          margin-top: 0.5rem;
        }
        .ft-mobile-auth a, .ft-mobile-auth button {
          display: block;
          width: 100%;
          text-align: center;
          padding: 0.85rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.15s;
          cursor: pointer;
          font-family: inherit;
        }
        .ft-mobile-auth .signin {
          color: #94a3b8;
          border: 1px solid rgba(148,163,184,0.2);
          background: transparent;
        }
        .ft-mobile-auth .signin:hover { color: #f1f5f9; border-color: rgba(148,163,184,0.4); }
        .ft-mobile-auth .join {
          color: #0f172a;
          background: #38bdf8;
          border: none;
        }
        .ft-mobile-auth .join:hover { opacity: 0.88; }
        .ft-mobile-auth .signout {
          color: #64748b;
          border: 1px solid rgba(148,163,184,0.15);
          background: transparent;
        }
        .ft-mobile-auth .signout:hover { color: #f1f5f9; border-color: rgba(148,163,184,0.3); }

        /* Responsive breakpoints */
        @media (max-width: 900px) {
          .ft-nav-links { display: none; }
          .ft-nav-auth { display: none; }
          .ft-burger { display: flex; }
          .ft-mobile-menu { display: block; }
        }
        @media (min-width: 901px) {
          .ft-mobile-menu { display: none !important; }
          .ft-burger { display: none !important; }
        }
      `}</style>

      <nav className="ft-nav">
        <div className="ft-nav-inner">
          {/* Logo */}
          <Link href="/" className="ft-nav-logo">
            Free<span>Trust</span>
          </Link>

          {/* Desktop nav links */}
          <div className="ft-nav-links">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`ft-nav-link${isActive(l.href) ? ' active' : ''}`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Desktop search + auth */}
          <div className="ft-nav-auth">
            <Link href="/search" className="ft-nav-search-btn" aria-label="Search">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </Link>
            <NotificationBell />
            {!authLoading && (
              user ? (
                <div className="ft-nav-user">
                  <Link href="/profile" className="ft-nav-avatar" title="My Profile">
                    {initials}
                  </Link>
                  <span className="ft-nav-email">{truncateEmail(user.email)}</span>
                  <button className="ft-nav-signout" onClick={handleSignOut}>Sign Out</button>
                </div>
              ) : (
                <>
                  <Link href="/login" className="ft-nav-signin">Sign In</Link>
                  <Link href="/register" className="ft-nav-join">Join Free</Link>
                </>
              )
            )}
          </div>

          {/* Hamburger (mobile only) */}
          <button
            className={`ft-burger${open ? ' is-open' : ''}`}
            onClick={() => setOpen(prev => !prev)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            <span className="ft-burger-bar" />
            <span className="ft-burger-bar" />
            <span className="ft-burger-bar" />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      <div className={`ft-mobile-menu${open ? ' is-open' : ''}`} aria-hidden={!open}>
        <div className="ft-mobile-inner">
          {/* Mobile user info or auth */}
          {!authLoading && (
            user ? (
              <div className="ft-mobile-user">
                <div className="ft-mobile-user-avatar">{initials}</div>
                <div className="ft-mobile-user-info">
                  <div className="ft-mobile-user-name">{user.name ?? 'My Account'}</div>
                  <div className="ft-mobile-user-email">{user.email}</div>
                </div>
              </div>
            ) : null
          )}

          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className={`ft-mobile-link${isActive(l.href) ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <div className="ft-mobile-divider" />
          <Link href="/search" className="ft-mobile-link" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:'0.65rem'}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Search
          </Link>
          <Link href="/profile" className="ft-mobile-link" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:'0.65rem'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            My Profile
          </Link>
          <Link href="/messages" className="ft-mobile-link" onClick={() => setOpen(false)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight:'0.65rem'}}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Messages
          </Link>
          <div className="ft-mobile-divider" />
          <div className="ft-mobile-auth">
            {!authLoading && (
              user ? (
                <button className="signout" onClick={handleSignOut}>Sign Out</button>
              ) : (
                <>
                  <Link href="/login" className="signin" onClick={() => setOpen(false)}>Sign In</Link>
                  <Link href="/register" className="join" onClick={() => setOpen(false)}>Join Free</Link>
                </>
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}
