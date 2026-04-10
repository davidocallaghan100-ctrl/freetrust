'use client'
import { usePathname } from 'next/navigation'
import Nav from './Nav'
import Sidebar from './Sidebar'
import BottomNav from './BottomNav'
import SearchBar from './SearchBar'
import TrustAssistant from './TrustAssistant'

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
          <footer style={{
            borderTop: '1px solid #1e293b',
            padding: '1.25rem 1.5rem',
            textAlign: 'center',
            fontSize: '0.78rem',
            color: '#475569',
            marginTop: '2rem',
          }}>
            &copy; 2026 FreeTrust. All rights reserved.
          </footer>
        </main>
      </div>
      <BottomNav />
      <TrustAssistant />
    </>
  )
}
