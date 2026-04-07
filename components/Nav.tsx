'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Home' },
  { href: '/feed', label: 'Feed' },
  { href: '/services', label: 'Services' },
  { href: '/products', label: 'Products' },
  { href: '/events', label: 'Events' },
  { href: '/community', label: 'Community' },
  { href: '/articles', label: 'Articles' },
  { href: '/organisations', label: 'Organisations' },
  { href: '/impact', label: 'Impact' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/wallet', label: 'Wallet' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      background: 'rgba(15,23,42,0.96)',
      borderBottom: '1px solid rgba(56,189,248,0.15)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}>
      <div style={{
        maxWidth: 1400,
        margin: '0 auto',
        padding: '0 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 58,
        gap: '1rem',
      }}>
        {/* Logo */}
        <Link href="/" style={{ fontSize: '1.2rem', fontWeight: 900, color: '#38bdf8', textDecoration: 'none', letterSpacing: '-0.5px', flexShrink: 0 }}>
          Free<span style={{ color: '#cbd5e1' }}>Trust</span>
        </Link>

        {/* Nav Links */}
        <div style={{ display: 'flex', gap: '0.15rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {links.map(l => {
            const active = path === l.href || (l.href !== '/' && path.startsWith(l.href))
            return (
              <Link key={l.href} href={l.href} style={{
                padding: '0.3rem 0.65rem',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontWeight: active ? 600 : 500,
                textDecoration: 'none',
                color: active ? '#38bdf8' : '#94a3b8',
                background: active ? 'rgba(56,189,248,0.1)' : 'transparent',
                border: `1px solid ${active ? 'rgba(56,189,248,0.3)' : 'transparent'}`,
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}>
                {l.label}
              </Link>
            )
          })}
        </div>

        {/* Auth buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
          <Link href="/login" style={{
            padding: '0.35rem 0.9rem',
            borderRadius: 6,
            fontSize: '0.82rem',
            fontWeight: 500,
            textDecoration: 'none',
            color: '#94a3b8',
            border: '1px solid rgba(148,163,184,0.2)',
            transition: 'all 0.15s',
          }}>
            Sign In
          </Link>
          <Link href="/register" style={{
            padding: '0.35rem 0.9rem',
            borderRadius: 6,
            fontSize: '0.82rem',
            fontWeight: 700,
            textDecoration: 'none',
            color: '#0f172a',
            background: '#38bdf8',
            transition: 'all 0.15s',
          }}>
            Join Free
          </Link>
        </div>
      </div>
    </nav>
  )
}
