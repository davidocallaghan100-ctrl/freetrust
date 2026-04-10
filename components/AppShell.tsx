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
        </main>
      </div>
      <BottomNav />
      <TrustAssistant />
    </>
  )
}
