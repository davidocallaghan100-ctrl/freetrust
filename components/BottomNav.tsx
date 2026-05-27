'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import Avatar from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'

const tabs = [
  { href: '/feed',        icon: '🏠', label: 'Home'     },
  { href: '/connections', icon: '🔗', label: 'Connect'  },
  { href: '/map',         icon: '🗺️', label: 'Map'      },
  null, // center Create button
  { href: '/calendar',    icon: '📅', label: 'Calendar' },
  { href: '/gig-economy', icon: '💼', label: 'Earn'     },
  { href: '/profile',     icon: '👤', label: 'Profile'  },
]

type AdminPage = {
  id: string
  name: string
  slug: string | null
  logo_url: string | null
  userRole?: string | null
}

type PersonalProfile = {
  id: string
  name: string
  username: string | null
  avatar_url: string | null
}

type FeedIdentity =
  | { type: 'personal'; id: string; name: string; username: string | null; avatar_url: string | null }
  | { type: 'org'; id: string; name: string; slug: string | null; logo_url: string | null; userRole?: string | null }

const FEED_IDENTITY_KEY = 'freetrust.feed.identity.v1'

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

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const switcherRef = useRef<HTMLDivElement | null>(null)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switcherLoading, setSwitcherLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)
  const [personalProfile, setPersonalProfile] = useState<PersonalProfile | null>(null)
  const [adminPages, setAdminPages] = useState<AdminPage[]>([])
  const [feedIdentity, setFeedIdentity] = useState<FeedIdentity | null>(null)

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  useEffect(() => {
    let cancelled = false

    async function loadSwitchablePages() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user ?? null
        if (!user || cancelled) {
          if (!cancelled) {
            setAuthenticated(false)
            setPersonalProfile(null)
            setAdminPages([])
            setFeedIdentity(null)
            setSwitcherOpen(false)
            try { window.localStorage.removeItem(FEED_IDENTITY_KEY) } catch { /* ignore storage */ }
            setSwitcherLoading(false)
          }
          return
        }
        if (!cancelled) setAuthenticated(true)

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .eq('id', user.id)
          .maybeSingle()

        if (!cancelled) {
          const nextProfile = {
            id: user.id,
            name: (profile?.full_name as string | null) || (profile?.username as string | null) || 'My profile',
            username: (profile?.username as string | null) ?? null,
            avatar_url: (profile?.avatar_url as string | null) ?? null,
          }
          setPersonalProfile(nextProfile)
          try {
            const personal: FeedIdentity = { type: 'personal', ...nextProfile }
            window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(personal))
            setFeedIdentity(personal)
          } catch { /* ignore storage */ }
        }

        let pages: AdminPage[] = []

        try {
          const res = await fetch('/api/organisations/mine', {
            cache: 'no-store',
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          })
          const data = await res.json().catch(() => ({ organisations: [] as AdminPage[] })) as { organisations?: AdminPage[] }
          pages = normalisePages(data.organisations ?? [])
        } catch {
          pages = []
        }

        // Mobile/PWA sessions can have the Supabase session available client-side
        // before SSR cookies/API routes catch up. Fall back to direct client reads
        // so an admin user still gets the switcher instead of being routed away.
        if (pages.length === 0) {
          const { data: memberships } = await supabase
            .from('organisation_members')
            .select('organisation_id, role')
            .eq('user_id', user.id)
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
            .eq('creator_id', user.id)
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

        if (!cancelled) {
          setAdminPages(pages)
          setFeedIdentity(current => {
            if (current?.type !== 'org') return current
            const refreshed = pages.find(page => page.id === current.id)
            return refreshed ? { type: 'org', ...refreshed } : current
          })
          setSwitcherLoading(false)
        }
      } catch {
        if (!cancelled) {
          setAdminPages([])
          setSwitcherLoading(false)
        }
      }
    }

    void loadSwitchablePages()
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setSwitcherLoading(true)
        void loadSwitchablePages()
      } else {
        setAuthenticated(false)
        setPersonalProfile(null)
        setAdminPages([])
        setFeedIdentity(null)
        setSwitcherOpen(false)
        try { window.localStorage.removeItem(FEED_IDENTITY_KEY) } catch { /* ignore storage */ }
        setSwitcherLoading(false)
      }
    })
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!switcherOpen) return
    const close = (event: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(event.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [switcherOpen])

  useEffect(() => {
    const syncIdentity = (event?: Event) => {
      if (!authenticated) {
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
  }, [authenticated])

  const activeAdminPage = useMemo(() => {
    if (!pathname.startsWith('/organisations/')) return null
    const key = decodeURIComponent(pathname.split('/')[2] ?? '')
    return adminPages.find(page => page.slug === key || page.id === key) ?? null
  }, [adminPages, pathname])

  const activeIdentity = activeAdminPage
    ? { name: activeAdminPage.name, image: activeAdminPage.logo_url }
    : feedIdentity?.type === 'org'
      ? { name: feedIdentity.name, image: feedIdentity.logo_url }
    : { name: personalProfile?.name ?? 'Profile', image: personalProfile?.avatar_url ?? null }

  const openProfileSwitcher = () => {
    setSwitcherOpen(v => !v)
  }

  const chooseIdentity = (href: string, identity: FeedIdentity) => {
    setFeedIdentity(identity)
    try {
      window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(identity))
      window.dispatchEvent(new CustomEvent('freetrust:feed-identity-change', { detail: identity }))
    } catch { /* ignore storage */ }
    setSwitcherOpen(false)
    if (pathname !== href) router.push(href)
  }

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
        height: '60px',
        background: '#0f172a',
        borderTop: '1px solid #1e293b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {tabs.map((tab) => {
          if (tab === null) {
            return (
              <button
                key="create"
                onClick={() => router.push(authenticated ? '/create' : '/login?redirect=%2Fcreate')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(56,189,248,0.4)',
                  flexShrink: 0,
                  fontSize: '20px',
                  color: '#fff',
                  fontWeight: 700,
                  lineHeight: 1,
                }}
                aria-label={authenticated ? 'Create' : 'Sign in to create'}
              >
                +
              </button>
            )
          }
          if (tab.href === '/profile') {
            const active = isActive('/profile') || Boolean(activeAdminPage)
            if (!authenticated) {
              return (
                <Link
                  key={tab.href}
                  href="/login?redirect=%2Fprofile"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', textDecoration: 'none', flex: 1, padding: '2px 0', position: 'relative' }}
                >
                  <span style={{ fontSize: '18px', lineHeight: 1 }}>{tab.icon}</span>
                  <span style={{ fontSize: '9px', fontWeight: 600, color: active ? '#38bdf8' : '#64748b', letterSpacing: '0.1px' }}>Sign in</span>
                </Link>
              )
            }
            return (
              <div
                key={tab.href}
                ref={switcherRef}
                style={{ flex: 1, position: 'relative', display: 'flex', justifyContent: 'center' }}
                onClick={e => e.stopPropagation()}
              >
                {switcherOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 4,
                      bottom: '58px',
                      width: 'min(260px, 88vw)',
                      maxHeight: '56vh',
                      overflowY: 'auto',
                      borderRadius: 18,
                      border: '1px solid rgba(96,165,250,0.28)',
                      background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.55), 0 0 24px rgba(56,189,248,0.12)',
                      padding: 8,
                      zIndex: 120,
                    }}
                    aria-label="Switch profile or page"
                  >
                    <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '7px 8px 8px' }}>
                      Switch profile/page
                    </div>
                    <button
                      type="button"
                      onClick={() => personalProfile && chooseIdentity('/profile', { type: 'personal', ...personalProfile })}
                      style={{
                        width: '100%',
                        minHeight: 48,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: (pathname.startsWith('/profile') || feedIdentity?.type === 'personal') ? '1px solid rgba(56,189,248,0.42)' : '1px solid transparent',
                        background: (pathname.startsWith('/profile') || feedIdentity?.type === 'personal') ? 'rgba(56,189,248,0.12)' : 'transparent',
                        color: '#f8fafc',
                        borderRadius: 12,
                        padding: '8px 9px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <Avatar url={personalProfile?.avatar_url ?? null} name={personalProfile?.name ?? 'Profile'} size={34} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personalProfile?.name ?? 'My profile'}</span>
                        <span style={{ display: 'block', color: '#94a3b8', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personalProfile?.username ? `@${personalProfile.username}` : 'Personal profile'}</span>
                      </span>
                      {pathname.startsWith('/profile') || feedIdentity?.type === 'personal' ? <span style={{ color: '#38bdf8', fontSize: 14 }}>✓</span> : null}
                    </button>
                    {adminPages.length > 0 || switcherLoading ? (
                      <div style={{ height: 1, background: 'rgba(51,65,85,0.8)', margin: '6px 4px' }} />
                    ) : null}
                    {switcherLoading ? (
                      <div style={{ color: '#94a3b8', fontSize: 12, padding: '9px 10px' }}>
                        Loading your pages…
                      </div>
                    ) : null}
                    {!switcherLoading && adminPages.length === 0 ? (
                      <div style={{ color: '#64748b', fontSize: 12, padding: '9px 10px' }}>
                        No admin pages found on this session.
                      </div>
                    ) : null}
                    {adminPages.map(page => {
                      const href = pageHref(page)
                      const selected = activeAdminPage?.id === page.id || (feedIdentity?.type === 'org' && feedIdentity.id === page.id)
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => chooseIdentity(href, { type: 'org', ...page })}
                          style={{
                            width: '100%',
                            minHeight: 48,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            border: selected ? '1px solid rgba(52,211,153,0.42)' : '1px solid transparent',
                            background: selected ? 'rgba(34,197,94,0.12)' : 'transparent',
                            color: '#f8fafc',
                            borderRadius: 12,
                            padding: '8px 9px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <Avatar url={page.logo_url} name={page.name} size={34} />
                          <span style={{ minWidth: 0, flex: 1 }}>
                            <span style={{ display: 'block', fontSize: 13, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.name}</span>
                            <span style={{ display: 'block', color: '#86efac', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{page.userRole === 'admin' ? 'Admin page' : 'Owner page'}</span>
                          </span>
                          {selected ? <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span> : null}
                        </button>
                      )
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={openProfileSwitcher}
                  aria-expanded={switcherOpen}
                  aria-haspopup="menu"
                  aria-label="Switch profile or admin page"
                  title="Switch profile or admin page"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '2px',
                    border: 'none',
                    background: 'transparent',
                    textDecoration: 'none',
                    flex: 1,
                    padding: '2px 0',
                    position: 'relative',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ position: 'relative', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Avatar url={activeIdentity.image} name={activeIdentity.name} size={22} />
                    <span style={{ position: 'absolute', right: -6, bottom: -2, width: 12, height: 12, borderRadius: '50%', background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', fontSize: 9, lineHeight: '10px', fontWeight: 900 }}>⌄</span>
                  </span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    color: active ? '#38bdf8' : '#64748b',
                    letterSpacing: '0.1px',
                  }}>
                    {activeAdminPage || feedIdentity?.type === 'org' ? 'Page' : 'Profile'}
                  </span>
                  {active && (
                    <span style={{
                      position: 'absolute',
                      bottom: 0,
                      width: '16px',
                      height: '2px',
                      background: '#38bdf8',
                      borderRadius: '2px',
                    }} />
                  )}
                </button>
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
                padding: '2px 0',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: '18px', lineHeight: 1 }}>{tab.icon}</span>
              <span style={{
                fontSize: '9px',
                fontWeight: 600,
                color: active ? '#38bdf8' : '#64748b',
                letterSpacing: '0.1px',
              }}>
                {tab.label}
              </span>
              {active && (
                <span style={{
                  position: 'absolute',
                  bottom: 0,
                  width: '16px',
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
