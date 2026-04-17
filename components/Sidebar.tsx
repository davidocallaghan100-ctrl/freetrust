'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const NAV_SECTIONS = [
  {
    label: 'DIGITAL',
    links: [
      { href: '/', label: 'Home', icon: '🏠' },
      { href: '/feed', label: 'Feed', icon: '📰' },
      { href: '/connections', label: 'Connections', icon: '🔗' },
      { href: '/messages', label: 'Messages', icon: '💬' },
      { href: '/notifications', label: 'Notifications', icon: '🔔' },
    ],
  },
  {
    label: 'SOCIAL',
    links: [
      { href: '/browse', label: 'Browse', icon: '🛍️' },
      { href: '/services', label: 'Services', icon: '🎯' },
      { href: '/products', label: 'Products', icon: '📦' },
      { href: '/grassroots', label: 'Grassroots', icon: '🌱' },
      { href: '/organisations', label: 'Organisations', icon: '🏢' },
      { href: '/rent-share', label: 'Rent & Share', icon: '♻️' },
    ],
  },
  {
    label: 'EVENTS',
    links: [
      { href: '/events', label: 'Events', icon: '📅' },
      { href: '/community', label: 'Groups', icon: '👥' },
      { href: '/jobs', label: 'Jobs', icon: '💼' },
      { href: '/articles', label: 'Articles', icon: '✍️' },
    ],
  },
  {
    label: 'PLANET',
    links: [
      { href: '/impact', label: 'Impact', icon: '🌍' },
      { href: '/collab', label: 'Collab', icon: '🤝' },
    ],
  },
  {
    label: 'EARN',
    links: [
      { href: '/gig-economy', label: 'Gig Economy', icon: '💰' },
      { href: '/seller/gigs/create', label: 'Create Gig', icon: '➕' },
      { href: '/agents', label: 'AI Agents', icon: '🤖' },
    ],
  },
  {
    label: 'EARLY INVESTORS',
    links: [
      { href: '/invest', label: 'Invest', icon: '⭐' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          setUserId(session.user.id)
          const { data } = await supabase
            .from('trust_balances')
            .select('balance')
            .eq('user_id', session.user.id)
            .maybeSingle()
          setWalletBalance(data?.balance ?? null)
        }
      } catch {
        // silently fail
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUserId(session.user.id)
        const { data } = await supabase
          .from('trust_balances')
          .select('balance')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setWalletBalance(data?.balance ?? null)
      } else {
        setUserId(null)
        setWalletBalance(null)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      <style>{`
        .ft-sidebar::-webkit-scrollbar { width: 4px; }
        .ft-sidebar::-webkit-scrollbar-track { background: transparent; }
        .ft-sidebar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
        .ft-sidebar a:hover {
          color: #e2e8f0 !important;
          background: rgba(255,255,255,0.04) !important;
        }
      `}</style>
      <aside
        className="ft-sidebar"
        style={{
          position: 'fixed',
          top: '58px',
          left: 0,
          width: '220px',
          height: 'calc(100vh - 58px)',
          background: '#0f172a',
          borderRight: '1px solid #1e293b',
          zIndex: 90,
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
        }}
      >
        <nav style={{ padding: '12px 0 24px' }}>
          {NAV_SECTIONS.map(section => (
            <div key={section.label} style={{ marginBottom: '4px' }}>
              <div style={{
                padding: '10px 16px 4px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#475569',
                userSelect: 'none',
              }}>
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
                      gap: '10px',
                      padding: '8px 16px',
                      fontSize: '13px',
                      fontWeight: active ? 600 : 400,
                      color: active ? '#38bdf8' : '#94a3b8',
                      textDecoration: 'none',
                      borderLeft: active ? '3px solid #38bdf8' : '3px solid transparent',
                      background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          ))}

          {userId && (
            <div style={{ borderTop: '1px solid #1e293b', marginTop: '8px', paddingTop: '8px' }}>
              {[
                {
                  href: '/wallet',
                  label: walletBalance !== null ? `Wallet (₮${walletBalance.toFixed(0)})` : 'Wallet',
                  icon: '💎',
                },
                { href: '/profile', label: 'Profile', icon: '👤' },
                { href: '/settings', label: 'Settings', icon: '⚙️' },
              ].map(({ href, label, icon }) => {
                const active = isActive(href)
                return (
                  <Link key={href} href={href} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: active ? 600 : 400,
                    color: active ? '#38bdf8' : '#94a3b8',
                    textDecoration: 'none',
                    borderLeft: active ? '3px solid #38bdf8' : '3px solid transparent',
                    background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: '15px', lineHeight: 1, flexShrink: 0 }}>{icon}</span>
                    <span>{label}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </nav>
      </aside>
    </>
  )
}
