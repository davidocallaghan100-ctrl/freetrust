'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import CreateMenu from '@/components/CreateMenu'

const tabs = [
  { href: '/', icon: '🏠', label: 'Home' },
  { href: '/connections', icon: '🔗', label: 'Connect' },
  null, // placeholder for center Create button
  { href: '/collab', icon: '🤝', label: 'Collab' },
  { href: '/profile', icon: '👤', label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href + '/'))

  return (
    <>
      <style>{`
        @media (min-width: 768px) { .ft-bottom-nav { display: none !important; } }
      `}</style>
      <nav className="ft-bottom-nav" style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        background: '#0f172a',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map((tab, i) => {
          if (tab === null) {
            // Center Create button
            return (
              <div key="create" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreateMenu asCenterButton />
              </div>
            )
          }
          const active = isActive(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2px',
                textDecoration: 'none',
                flex: 1,
                padding: '4px 0',
              }}
            >
              <span style={{ fontSize: '20px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: active ? '#38bdf8' : '#64748b',
                letterSpacing: '0.2px',
              }}>
                {tab.label}
              </span>
              {active && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '20px',
                  height: '2px',
                  background: '#38bdf8',
                  borderRadius: '2px',
                }} />
              )}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
