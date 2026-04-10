'use client'
import { usePathname } from 'next/navigation'
import Nav from './Nav'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import SearchBar from './SearchBar'
import TrustAssistant from './TrustAssistant'
import Link from 'next/link'

const AUTH_PATHS = ['/login', '/register', '/onboarding']

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = AUTH_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  if (isAuth) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a' }}>
        {children}
      </div>
    )
  }

  return (
    <>
      <Nav />
      <SearchBar />
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main className="ft-page-content">
          {children}
        </main>
      </div>
      <BottomNav />
      <TrustAssistant />
      <style>{`
        @media (max-width: 768px) { .ft-fab { display: none !important; } }
      `}</style>
      <Link
        href="/create"
        className="ft-fab"
        style={{
          position: 'fixed',
          bottom: '160px',
          right: '2rem',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '26px',
          color: '#fff',
          fontWeight: 700,
          textDecoration: 'none',
          boxShadow: '0 4px 20px rgba(56,189,248,0.45)',
          zIndex: 90,
          lineHeight: 1,
        }}
        aria-label="Create"
      >
        +
      </Link>
    </>
  )
}
