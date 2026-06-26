'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useDirection } from '@/hooks/useDirection'
import { isWholeIslandIrelandProfile } from '@/lib/experience/irelandAccess'

const EMOJI_STYLE = {
  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif',
  lineHeight: 1,
} as const

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
      { href: '/services', label: 'Services Marketplace', icon: '🛠' },
      { href: '/grassroots', label: 'Grassroots', icon: '🌱' },
      { href: '/products', label: 'Products', icon: '📦' },
      { href: '/travel', label: 'Experience Travel', icon: '✈️' },
      { href: '/experience-pubs', label: 'Pubs', icon: '🍺' },
      { href: '/organisations', label: 'Organisations', icon: '🏢' },
      { href: '/rent-share', label: 'Rent & Share', icon: '♻️' },
    ],
  },
  {
    label: 'EVENTS',
    links: [
      { href: '/events', label: 'Events', icon: '📅' },
      { href: '/calendar', label: 'My Calendar', icon: '🗓️' },
      { href: '/map', label: 'Activity Map', icon: '🗺️' },
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
      { href: '/accounting', label: 'Accounting', icon: '📊' },
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
  const tNav = useTranslations('nav')
  const dir = useDirection()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [userId, setUserId] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [pubExperienceEligible, setPubExperienceEligible] = useState(false)

  // Fetch unread notification count
  const fetchUnread = async () => {
    try {
      const res = await fetch('/api/notifications?unread=true&limit=1')
      if (res.ok) {
        const data = await res.json()
        setUnreadNotifs(data.unreadCount ?? 0)
      }
    } catch { /* silent */ }
  }

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
          const { data: profile } = await supabase
            .from('profiles')
            .select('country, city, location, location_label')
            .eq('id', session.user.id)
            .maybeSingle()
          setWalletBalance(data?.balance ?? null)
          setPubExperienceEligible(isWholeIslandIrelandProfile(profile))
          // Fetch unread count on mount
          void fetchUnread()
          // Subscribe to realtime notifications
          supabase
            .channel(`sidebar-notif:${session.user.id}`)
            .on('postgres_changes', {
              event: 'INSERT', schema: 'public', table: 'notifications',
              filter: `user_id=eq.${session.user.id}`,
            }, () => { setUnreadNotifs(prev => prev + 1) })
            .subscribe()
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
        const { data: profile } = await supabase
          .from('profiles')
          .select('country, city, location, location_label')
          .eq('id', session.user.id)
          .maybeSingle()
        setWalletBalance(data?.balance ?? null)
        setPubExperienceEligible(isWholeIslandIrelandProfile(profile))
        void fetchUnread()
      } else {
        setUserId(null)
        setWalletBalance(null)
        setUnreadNotifs(0)
        setPubExperienceEligible(false)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  const navLabel = (label: string) => ({
    DIGITAL: tNav('digital'), SOCIAL: tNav('social'), EVENTS: tNav('events'), PLANET: tNav('planet'), EARN: tNav('earn'), 'EARLY INVESTORS': tNav('earlyInvestors'),
    Home: tNav('home'), Feed: tNav('newsfeed'), Connections: tNav('connections'), Messages: tNav('messages'), Notifications: tNav('notifications'), Browse: tNav('browse'), 'Services Marketplace': tNav('servicesMarketplace'), Grassroots: tNav('grassroots'), Products: tNav('products'), 'Experience Travel': tNav('travel'), Pubs: 'Pubs', Organisations: tNav('organisations'), 'Rent & Share': tNav('rentShare'), Events: tNav('events'), 'My Calendar': tNav('myCalendar'), 'Activity Map': tNav('activityMap'), Groups: tNav('groups'), Jobs: tNav('jobs'), Articles: tNav('articles'), Impact: tNav('impact'), Collab: tNav('collab'), 'Gig Economy': tNav('gigEconomy'), 'Create Gig': tNav('createGig'), Accounting: tNav('accounting'), Invest: tNav('invest'), Wallet: tNav('wallet'), Agents: tNav('agents'), Profile: tNav('profile'), Settings: tNav('settings'),
  } as Record<string, string>)[label] ?? label

  const visibleNavSections = NAV_SECTIONS
    .map(section => ({ ...section, links: section.links.filter(link => link.href !== '/experience-pubs' || pubExperienceEligible) }))
    .filter(section => section.links.length > 0)

  // Clear unread badge when on notifications page
  useEffect(() => {
    if (pathname === '/notifications') {
      setUnreadNotifs(0)
    }
  }, [pathname])

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
          left: dir === 'rtl' ? undefined : 0,
          right: dir === 'rtl' ? 0 : undefined,
          width: '220px',
          height: 'calc(100vh - 58px)',
          background: '#0f172a',
          borderRight: dir === 'rtl' ? undefined : '1px solid #1e293b',
          borderLeft: dir === 'rtl' ? '1px solid #1e293b' : undefined,
          zIndex: 90,
          overflowY: 'auto',
          overflowX: 'hidden',
          flexShrink: 0,
        }}
      >
        <nav style={{ padding: '12px 0 24px' }}>
          {visibleNavSections.map(section => (
            <div key={section.label} style={{ marginBottom: '4px' }}>
              <div style={{
                padding: '10px 16px 4px',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#475569',
                userSelect: 'none',
              }}>
                {navLabel(section.label)}
              </div>
              {section.links.map(({ href, label, icon }) => {
                const active = isActive(href)
                const isNotifications = href === '/notifications'
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
                      borderLeft: dir === 'rtl' ? undefined : (active ? '3px solid #38bdf8' : '3px solid transparent'),
                      borderRight: dir === 'rtl' ? (active ? '3px solid #38bdf8' : '3px solid transparent') : undefined,
                      background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span style={{ ...EMOJI_STYLE, fontSize: '15px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ flex: 1 }}>{navLabel(label)}</span>
                    {isNotifications && unreadNotifs > 0 && (
                      <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        borderRadius: 999,
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 5px',
                        lineHeight: '16px',
                        minWidth: 16,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}>
                        {unreadNotifs > 99 ? '99+' : unreadNotifs}
                      </span>
                    )}
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
                  label: walletBalance !== null ? `${tNav('wallet')} (₮${walletBalance.toFixed(0)})` : tNav('wallet'),
                  icon: '💎',
                },
                  { href: '/agents', label: tNav('agents'), icon: '😎' },
                  { href: '/profile', label: tNav('profile'), icon: '👤' },
                  { href: '/settings', label: tNav('settings'), icon: '⚙️' },
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
                    borderLeft: dir === 'rtl' ? undefined : (active ? '3px solid #38bdf8' : '3px solid transparent'),
                    borderRight: dir === 'rtl' ? (active ? '3px solid #38bdf8' : '3px solid transparent') : undefined,
                    background: active ? 'rgba(56,189,248,0.08)' : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ ...EMOJI_STYLE, fontSize: '15px', flexShrink: 0 }}>{icon}</span>
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
