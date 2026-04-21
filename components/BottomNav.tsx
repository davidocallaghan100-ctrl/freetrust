'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const tabs = [
  { href: '/feed', icon: '🏠', label: 'Home' },
  { href: '/map', icon: '🗺️', label: 'Map' },
  null, // center Create button
  { href: '/calendar', icon: '📅', label: 'Calendar' },
  { href: '/profile', icon: '👤', label: 'Profile' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

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
            // Centre floating + button → /create
            return (
              <button
                key="create"
                onClick={() => router.push('/create')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 16px rgba(56,189,248,0.4)',
                  flexShrink: 0,
                  fontSize: '22px',
                  color: '#fff',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                aria-label="Create"
              >
                +
              </button>
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
                position: 'relative',
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
