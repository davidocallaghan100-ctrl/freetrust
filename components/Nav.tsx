'use client'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState, useEffect, useRef } from 'react'
import NotificationBell from '@/components/notifications/NotificationBell'
import Avatar from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'
import CurrencySwitcher from '@/components/CurrencySwitcher'
import LanguageSelector from '@/components/LanguageSelector'
import { isWholeIslandIrelandProfile } from '@/lib/experience/irelandAccess'
import { isFreeTrustAdminEmail } from '@/lib/admin/emails'

const FREETRUST_LOGO_SRC = '/icons/freetrust-mark-perfect-transparent-20260521.png'
const FREETRUST_LOGO_STYLE = {
  flexShrink: 0,
  display: 'block',
  objectFit: 'contain' as const,
  filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.55)) drop-shadow(0 0 5px rgba(52,211,153,0.35))',
}

const EMOJI_STYLE = {
  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Segoe UI Symbol", sans-serif',
  lineHeight: 1,
} as const

const DRAWER_SECTIONS = [
  {
    label: 'DIGITAL',
    links: [
      { href: '/wallet',    label: 'Trust Wallet',          icon: '💎' },
      { href: '/feed',      label: 'Newsfeed',               icon: '📰' },
      { href: '/products',  label: 'Product Marketplace',    icon: '📦' },
      { href: '/services',  label: 'Services Marketplace',   icon: '🛠' },
      { href: '/grassroots', label: 'Grassroots',             icon: '🌱' },
      { href: '/members', label: 'Member Directory',     icon: '🔍' },
      { href: '/messages', label: 'Messages',             icon: '💬' },
    ],
  },
  {
    label: 'SOCIAL',
    links: [
      { href: '/community',       label: 'Groups',             icon: '👥' },
      { href: '/articles',        label: 'Articles',          icon: '✍️' },
      { href: '/jobs',            label: 'Jobs',              icon: '💼' },
      { href: '/rent-share',      label: 'Rent & Share',      icon: '♻️' },
      { href: '/organisations',   label: 'Organisations',     icon: '🏢' },
      { href: '/organisations/new', label: 'Add Organisation', icon: '➕' },
    ],
  },
  {
    label: 'EVENTS',
    links: [
      { href: '/events',        label: 'Directory',    icon: '📅' },
      { href: '/calendar',      label: 'My Calendar',  icon: '🗓️' },
      { href: '/map',           label: 'Activity Map', icon: '🗺️' },
      { href: '/events/create', label: 'Add Event',    icon: '➕' },
    ],
  },
  {
    label: 'PLANET',
    links: [
      { href: '/impact', label: 'Impact', icon: '🌍' },
    ],
  },
  {
    label: 'EARLY INVESTORS',
    links: [
      { href: '/invest',      label: 'Early Investors', icon: '💰' },
      { href: '/invest/deck', label: 'Investor Deck',       icon: '📊' },
    ],
  },
  {
    label: 'CREATE',
    links: [
      { href: '/agents', label: 'Agents', icon: '😎' },
    ],
  },
  {
    label: 'BUILD',
    links: [
      { href: '/build', label: 'Build', icon: '🏗️' },
    ],
  },
  {
    label: 'EXPERIENCE',
    links: [
      { href: '/travel', label: 'Travel', icon: '✈️' },
      { href: '/experience-pubs', label: 'Pubs', icon: '🍺' },
      { href: '/experience-activities', label: 'Activities', icon: '🏃' },
      { href: '/fitplan', label: 'FitPlan', icon: '🏋️' },
    ],
  },
]

type AdminPage = {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  userRole?: string | null
}

type FeedIdentity =
  | { type: 'personal'; id: string; name: string; username: string | null; avatar_url: string | null }
  | { type: 'org'; id: string; name: string; slug: string | null; logo_url: string | null; userRole?: string | null }

const FEED_IDENTITY_KEY = 'freetrust.feed.identity.v1'

function clearStoredFeedIdentity() {
  try { window.localStorage.removeItem(FEED_IDENTITY_KEY) } catch { /* ignore storage */ }
}

function pageHref(page: AdminPage) {
  return `/organisations/${encodeURIComponent(page.slug || page.id)}`
}

function normalisePages(pages: AdminPage[]) {
  const seen = new Set<string>()
  return pages
    .filter(page => page?.id && page?.name)
    .filter(page => {
      if (seen.has(page.id)) return false
      seen.add(page.id)
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default function Nav() {
  const router   = useRouter()
  const pathname = usePathname()
  const tNav = useTranslations('nav')
  const tAuth = useTranslations('auth')
  const tProfile = useTranslations('profile')
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const [user, setUser] = useState<{
    id: string; email: string | null; name: string | null; avatar: string | null
  } | null>(null)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [profileOpen, setProfileOpen] = useState(false)
  const [drawerOpen,  setDrawerOpen]  = useState(false)
  const [adminPages, setAdminPages] = useState<AdminPage[]>([])
  const [pagesLoading, setPagesLoading] = useState(true)
  const [feedIdentity, setFeedIdentity] = useState<FeedIdentity | null>(null)
  const [pubExperienceEligible, setPubExperienceEligible] = useState(false)

  const profileRef = useRef<HTMLDivElement>(null)

  /* ── auth ── */
  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const [profileRes, walletRes] = await Promise.all([
            supabase.from('profiles').select('full_name, avatar_url, country, city, location, location_label').eq('id', session.user.id).maybeSingle(),
            supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
          ])
          const nextUser = { id: session.user.id, email: session.user.email ?? null, name: profileRes.data?.full_name ?? null, avatar: profileRes.data?.avatar_url ?? null }
          setUser(nextUser)
          setPubExperienceEligible(isWholeIslandIrelandProfile(profileRes.data))
          setWalletBalance(walletRes.data?.balance ?? null)
          try {
            const personal: FeedIdentity = { type: 'personal', id: nextUser.id, name: nextUser.name ?? tProfile('myProfile'), username: null, avatar_url: nextUser.avatar }
            window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(personal))
            setFeedIdentity(personal)
          } catch { /* ignore storage */ }
          await loadAdminPages(session.user.id, session.access_token)
        } else {
          setUser(null)
          setWalletBalance(null)
          setAdminPages([])
          setFeedIdentity(null)
          setPubExperienceEligible(false)
          clearStoredFeedIdentity()
          setPagesLoading(false)
        }
      } finally { setLoading(false) }
    }
    const loadAdminPages = async (userId: string, accessToken?: string) => {
      setPagesLoading(true)
      try {
        let pages: AdminPage[] = []
        try {
          const res = await fetch('/api/organisations/mine', {
            cache: 'no-store',
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          })
          const data = await res.json().catch(() => ({ organisations: [] as AdminPage[] })) as { organisations?: AdminPage[] }
          pages = normalisePages(data.organisations ?? [])
        } catch {
          pages = []
        }

        if (pages.length === 0) {
          const { data: memberships } = await supabase
            .from('organisation_members')
            .select('organisation_id, role')
            .eq('user_id', userId)
            .in('role', ['owner', 'admin'])

          const roleByOrgId = new Map<string, string>()
          const orgIds = (memberships ?? [])
            .map(membership => {
              const organisationId = (membership as { organisation_id?: string | null }).organisation_id
              const role = (membership as { role?: string | null }).role
              if (organisationId && role) roleByOrgId.set(organisationId, role)
              return organisationId
            })
            .filter((id): id is string => Boolean(id))

          const directPages: AdminPage[] = []
          if (orgIds.length > 0) {
            const { data: orgs } = await supabase
              .from('organisations')
              .select('id, name, slug, logo_url')
              .in('id', orgIds)
              .eq('status', 'active')

            directPages.push(...((orgs ?? []) as Array<{ id: string; name: string; slug: string | null; logo_url: string | null }>).map(org => ({
              id: org.id,
              name: org.name,
              slug: org.slug,
              logo_url: org.logo_url,
              userRole: roleByOrgId.get(org.id) ?? 'admin',
            })))
          }

          const { data: createdOrgs } = await supabase
            .from('organisations')
            .select('id, name, slug, logo_url')
            .eq('creator_id', userId)
            .eq('status', 'active')

          directPages.push(...((createdOrgs ?? []) as Array<{ id: string; name: string; slug: string | null; logo_url: string | null }>).map(org => ({
            id: org.id,
            name: org.name,
            slug: org.slug,
            logo_url: org.logo_url,
            userRole: 'owner',
          })))

          pages = normalisePages(directPages)
        }

        setAdminPages(pages)
        setFeedIdentity(current => {
          if (current?.type !== 'org') return current
          const refreshed = pages.find(page => page.id === current.id)
          return refreshed ? { type: 'org', ...refreshed } : current
        })
      } catch {
        setAdminPages([])
      } finally {
        setPagesLoading(false)
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session?.user) {
        const [profileRes, walletRes] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url, country, city, location, location_label').eq('id', session.user.id).maybeSingle(),
          supabase.from('trust_balances').select('balance').eq('user_id', session.user.id).maybeSingle(),
        ])
        const nextUser = { id: session.user.id, email: session.user.email ?? null, name: profileRes.data?.full_name ?? null, avatar: profileRes.data?.avatar_url ?? null }
        setUser(nextUser)
        setPubExperienceEligible(isWholeIslandIrelandProfile(profileRes.data))
        setWalletBalance(walletRes.data?.balance ?? null)
        try {
          const personal: FeedIdentity = { type: 'personal', id: nextUser.id, name: nextUser.name ?? tProfile('myProfile'), username: null, avatar_url: nextUser.avatar }
          window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(personal))
          setFeedIdentity(personal)
        } catch { /* ignore storage */ }
        await loadAdminPages(session.user.id, session.access_token)
      } else { setUser(null); setWalletBalance(null); setAdminPages([]); setFeedIdentity(null); setPubExperienceEligible(false); clearStoredFeedIdentity(); setPagesLoading(false) }
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

  /* ── keep top-left switcher synced with page/profile changes elsewhere ── */
  useEffect(() => {
    const syncIdentity = (event?: Event) => {
      if (!user) {
        setFeedIdentity(null)
        return
      }
      const detail = event && 'detail' in event ? (event as CustomEvent<FeedIdentity>).detail : null
      if (detail) {
        setFeedIdentity(detail)
        return
      }
      try {
        const raw = window.localStorage.getItem(FEED_IDENTITY_KEY)
        if (raw) setFeedIdentity(JSON.parse(raw) as FeedIdentity)
      } catch { /* ignore storage */ }
    }
    window.addEventListener('freetrust:feed-identity-change', syncIdentity)
    window.addEventListener('storage', syncIdentity)
    return () => {
      window.removeEventListener('freetrust:feed-identity-change', syncIdentity)
      window.removeEventListener('storage', syncIdentity)
    }
  }, [user])

  /* ── lock body scroll when drawer open ── */
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  const handleSignOut = async () => {
    setDrawerOpen(false)
    setProfileOpen(false)
    clearStoredFeedIdentity()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
  const isLanding = pathname === '/'

  const chooseFeedIdentity = (href: string, identity: FeedIdentity) => {
    setFeedIdentity(identity)
    setProfileOpen(false)
    try {
      window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(identity))
      window.dispatchEvent(new CustomEvent('freetrust:feed-identity-change', { detail: identity }))
    } catch { /* ignore storage */ }
    if (pathname !== href) router.push(href)
  }

  const activeProfileIdentity = feedIdentity?.type === 'org'
    ? { name: feedIdentity.name, image: feedIdentity.logo_url, subtitle: feedIdentity.userRole === 'admin' ? tProfile('adminPage') : tProfile('ownerPage') }
    : { name: user?.name ?? tProfile('yourProfile'), image: user?.avatar ?? null, subtitle: user?.email ?? '' }
  const isAdminUser = isFreeTrustAdminEmail(user?.email)

  const navLabel = (label: string) => ({
    DIGITAL: tNav('digital'), SOCIAL: tNav('social'), EVENTS: tNav('events'), PLANET: tNav('planet'), 'EARLY INVESTORS': tNav('earlyInvestors'), CREATE: tNav('create'), EXPERIENCE: tNav('experience'), ACCOUNT: tNav('account'),
    'Trust Wallet': tNav('wallet'), Newsfeed: tNav('newsfeed'), 'Product Marketplace': tNav('productMarketplace'), 'Services Marketplace': tNav('servicesMarketplace'), Grassroots: tNav('grassroots'), 'Member Directory': tNav('memberDirectory'),
    Groups: tNav('groups'), Articles: tNav('articles'), Jobs: tNav('jobs'), 'Rent & Share': tNav('rentShare'), Organisations: tNav('organisations'), 'Add Organisation': tNav('addOrganisation'), Directory: tNav('directory'), 'My Calendar': tNav('myCalendar'), 'Activity Map': tNav('activityMap'), 'Add Event': tNav('addEvent'),
    Impact: tNav('impact'), 'Early Investors': tNav('earlyInvestors'), 'Investor Deck': tNav('investorDeck'), Agents: tNav('agents'), Travel: tNav('travel'), Pubs: 'Pubs', Profile: tNav('profile'), 'Analytics Dashboard': tNav('analytics'), Settings: tNav('settings'),
  } as Record<string, string>)[label] ?? label

  const visibleDrawerSections = DRAWER_SECTIONS
    .map(section => ({ ...section, links: section.links.filter(link => link.href !== '/experience-pubs' || pubExperienceEligible) }))
    .filter(section => section.links.length > 0)

  if (pathname === '/agents') return null

  return (
    <>
      {/* ── Top bar ── */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: '58px',
        background: '#0f172a', borderBottom: '1px solid #1e293b',
        zIndex: 100, display: 'flex', alignItems: 'center', padding: '0 4px 0 12px', gap: '8px',
        overflow: 'visible',
      }}>

        {/* Profile avatar — top left */}
        {!loading && user && (
          <div ref={profileRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setProfileOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', padding: '3px', borderRadius: '50%', outline: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
              aria-label={tProfile('switchProfile')}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
            >
              <Avatar url={activeProfileIdentity.image} name={activeProfileIdentity.name} email={user.email} size={32} />
            </button>
            {profileOpen && (
              <div style={{ position: 'fixed', left: '12px', top: '62px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', minWidth: '220px', maxWidth: 'calc(100vw - 24px)', overflow: 'hidden', zIndex: 200 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Avatar url={activeProfileIdentity.image} name={activeProfileIdentity.name} email={user.email} size={38} />
                  <div style={{ overflow: 'hidden', flex: 1 }}>
                    <div style={{ fontSize: '13px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProfileIdentity.name}</div>
                    <Link href={feedIdentity?.type === 'org' ? pageHref(feedIdentity) : '/profile'} onClick={() => setProfileOpen(false)} style={{ fontSize: '11px', color: feedIdentity?.type === 'org' ? '#86efac' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>{activeProfileIdentity.subtitle}</Link>
                  </div>
                </div>
                <div style={{ padding: '8px 8px 4px' }}>
                  <div style={{ color: '#94a3b8', fontSize: 10, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 8px 7px' }}>
                    {tProfile('switchProfile')}
                  </div>
                  <button type="button" onClick={() => chooseFeedIdentity('/profile', { type: 'personal', id: user.id, name: user.name ?? tProfile('myProfile'), username: null, avatar_url: user.avatar })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px', fontSize: '13px', color: '#f8fafc', textDecoration: 'none', borderRadius: 10, background: (pathname.startsWith('/profile') || feedIdentity?.type === 'personal') ? 'rgba(56,189,248,0.12)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                    <Avatar url={user.avatar} name={user.name} email={user.email} size={30} />
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? tProfile('myProfile')}</span>
                      <span style={{ display: 'block', color: '#94a3b8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tProfile('personalProfile')}</span>
                    </span>
                    {feedIdentity?.type === 'personal' ? <span style={{ color: '#38bdf8', fontSize: 14 }}>✓</span> : null}
                  </button>
                  {pagesLoading ? (
                    <div style={{ color: '#94a3b8', fontSize: 12, padding: '8px' }}>{tProfile('loadingPages')}</div>
                  ) : adminPages.length === 0 ? (
                    <div style={{ color: '#64748b', fontSize: 12, padding: '8px' }}>{tProfile('noAdminPages')}</div>
                  ) : adminPages.map(page => (
                    <button key={page.id} type="button" onClick={() => chooseFeedIdentity(pageHref(page), { type: 'org', ...page })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px', fontSize: '13px', color: '#f8fafc', textDecoration: 'none', borderRadius: 10, background: feedIdentity?.type === 'org' && feedIdentity.id === page.id ? 'rgba(34,197,94,0.12)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                      <Avatar url={page.logo_url} name={page.name} size={30} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.name}</span>
                        <span style={{ display: 'block', color: '#86efac', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.userRole === 'admin' ? tProfile('adminPage') : tProfile('ownerPage')}</span>
                      </span>
                      {feedIdentity?.type === 'org' && feedIdentity.id === page.id ? <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span> : null}
                    </button>
                  ))}
                </div>
                <div style={{ height: 1, background: '#334155' }} />
                 {[
                   { href: '/create',      icon: '✏️', label: tNav('createPost')  },
                   { href: '/dashboard',   icon: '📊', label: tNav('dashboard')    },
                   { href: '/wallet',      icon: '💎', label: tNav('wallet')       },
                   { href: '/connections', icon: '🔗', label: tNav('connections')  },
                   { href: '/settings',    icon: '⚙️', label: tNav('settings')     },
                 ].map(({ href, icon, label }) => (
                   <Link key={href} href={href} onClick={() => setProfileOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px', color: '#cbd5e1', textDecoration: 'none' }}>
                     <span style={{ ...EMOJI_STYLE, fontSize: '14px' }}>{icon}</span>
                     <span>{label}</span>
                   </Link>
                 ))}
                <div style={{ borderTop: '1px solid #334155' }}>
                  <button onClick={handleSignOut} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 16px', fontSize: '13px', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {tAuth('signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Logo — always links to landing page */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
          <img src={FREETRUST_LOGO_SRC} alt="FreeTrust" style={{ ...FREETRUST_LOGO_STYLE, width: '34px', height: '34px' }} />
          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>FreeTrust</span>
        </Link>

        <div style={{ flex: 1 }} />

        {/* Right side — hamburger always last and always visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, paddingRight: '8px' }}>
          {user && walletBalance !== null && (
            <Link href="/wallet" title={tNav('wallet')} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 8px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#38bdf8', textDecoration: 'none', flexShrink: 0 }}>
              ₮{walletBalance.toFixed(0)}
              <span style={{ fontSize: '9px', fontWeight: 500, color: '#64748b', lineHeight: 1 }}>{tNav('balanceAbbr')}</span>
            </Link>
          )}
          <CurrencySwitcher compact />
          {isLanding && <LanguageSelector variant="header" />}
          {user && <NotificationBell />}
          {!loading && !user && (
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              <Link href="/login" style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, color: '#94a3b8', textDecoration: 'none', border: '1px solid #334155' }}>{tAuth('signIn')}</Link>
              <Link href="/register" style={{ padding: '6px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#fff', textDecoration: 'none', background: 'linear-gradient(135deg, #38bdf8, #818cf8)' }}>{tAuth('signUp')}</Link>
            </div>
          )}
          {loading && <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e293b', flexShrink: 0 }} />}

          {/* ── Hamburger — always last, never squished ── */}
          <button
            onClick={() => setDrawerOpen(v => !v)}
            aria-label={tNav('openMenu')}
            style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '5px', width: '36px', height: '36px', minWidth: '36px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', padding: '6px', flexShrink: 0 }}
          >
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#94a3b8', borderRadius: '2px', transition: 'all 0.25s ease', transform: drawerOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#94a3b8', borderRadius: '2px', transition: 'all 0.25s ease', opacity: drawerOpen ? 0 : 1, transform: drawerOpen ? 'scaleX(0)' : 'none' }} />
            <span style={{ display: 'block', width: '20px', height: '2px', background: '#94a3b8', borderRadius: '2px', transition: 'all 0.25s ease', transform: drawerOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>
      </header>

      {/* ── Create button — pinned just below the hamburger ── */}
      {user && (
        <Link
          href="/create"
          aria-label={tNav('create')}
          style={{
            position: 'fixed',
            top: '64px',
            right: '12px',
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '22px',
            fontWeight: 700,
            color: '#fff',
            textDecoration: 'none',
            boxShadow: '0 2px 10px rgba(56,189,248,0.35)',
            zIndex: 99,
            lineHeight: 1,
          }}
        >
          +
        </Link>
      )}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <img src={FREETRUST_LOGO_SRC} alt="FreeTrust" style={{ ...FREETRUST_LOGO_STYLE, width: '28px', height: '28px' }} />
            <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px' }}>FreeTrust</span>
          </div>
          <button onClick={() => setDrawerOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#1e293b', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }} aria-label={tNav('closeMenu')}>
            ✕
          </button>
        </div>

        {/* User info strip (if logged in) */}
        {user && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Link href="/profile" onClick={() => setDrawerOpen(false)} style={{ flexShrink: 0, textDecoration: 'none' }}>
              <Avatar url={user.avatar} name={user.name} email={user.email} size={40} />
            </Link>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div style={{ fontSize: '14px', color: '#f1f5f9', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name ?? tProfile('yourProfile')}</div>
              <Link href="/profile" onClick={() => setDrawerOpen(false)} style={{ fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>{user.email}</Link>
            </div>
          </div>
        )}

        {/* Nav sections */}
        <div style={{ padding: '12px 0', flex: 1 }}>
          {visibleDrawerSections.map(section => (
            <div key={section.label} style={{ marginBottom: '8px' }}>
              <div style={{ padding: '8px 20px 4px', fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                {navLabel(section.label)}
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
                    <span style={{ ...EMOJI_STYLE, fontSize: '16px' }}>{icon}</span>
                    {navLabel(label)}
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

        {/* Account section at bottom */}
        <div style={{ borderTop: '1px solid #1e293b', paddingTop: '8px', paddingBottom: '16px' }}>
          <div style={{ padding: '8px 20px 4px', fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {tNav('account')}
          </div>
          {user && [
            { href: '/profile', label: 'Profile', icon: '👤' },
            { href: '/analytics', label: 'Analytics Dashboard', icon: '📊' },
            ...(isAdminUser ? [{ href: '/admin', label: 'Admin Analytics', icon: '🔒' }] : []),
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
                <span style={{ ...EMOJI_STYLE, fontSize: '16px' }}>{icon}</span>
                {navLabel(label)}
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
              {tAuth('signOut')}
            </button>
          ) : (
            <>
              <Link href="/login" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', fontSize: '14px', color: '#38bdf8', textDecoration: 'none', borderLeft: '3px solid transparent' }}>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>🔑</span>
                {tAuth('signIn')}
              </Link>
              <Link href="/register" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 20px', fontSize: '14px', color: '#c4b5fd', textDecoration: 'none', borderLeft: '3px solid transparent' }}>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>✨</span>
                {tAuth('createAccount')}
              </Link>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
