'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import MapboxMap, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { PUB_EXPERIENCE_RESTRICTED_MESSAGE } from '@/lib/experience/irelandAccess'

type ActivityType = 'casual_pints' | 'trad_session' | 'quiz_night' | 'sport_watch' | 'live_music' | 'after_work' | 'celebration' | 'other'
type TabKey = 'nearby' | 'activities' | 'invites'
type FilterKey = 'all' | 'live_music' | 'quiz_night' | 'sport_watch' | 'verified' | 'friends'

type Pub = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  lat: string | number
  lng: string | number
  is_verified: boolean | null
  avg_rating: string | number | null
  data_source?: string | null
  source_url?: string | null
  tags?: { osm_tags?: string[] | Record<string, string | number | boolean | null | undefined> } | null
}

type Profile = {
  id: string
  full_name: string | null
  first_name?: string | null
  last_name?: string | null
  avatar_url: string | null
  trust_balance?: number | null
}

type Attendee = {
  id?: string
  activity_id: string
  user_id: string
  status: 'going' | 'maybe' | 'declined'
}

type ActivityRow = {
  id: string
  pub_id: string
  created_by: string
  title: string
  description: string | null
  activity_type: ActivityType | null
  scheduled_at: string
  max_attendees: number | null
  is_open_to_all: boolean | null
  status: 'active' | 'cancelled' | 'completed'
  pub?: Pub | null
  attendees?: Attendee[] | null
  creator?: Profile | null
  creatorTrust?: number
}

type InviteRow = {
  id: string
  from_user_id: string
  to_user_id: string
  activity_id: string | null
  pub_id: string | null
  message: string | null
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  pub?: Pub | null
  activity?: ActivityRow | null
  sender?: Profile | null
  senderTrust?: number
}

type Friend = Profile & { trust_score: number }

const MAP_STYLE = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const HARP_LOGO_URL = 'https://davidocallaghan100829028694.adaptive.ai/cdn/L7R6HFi879eCpWRNirDQ6zbcgxeiTJyN.webp'

const COLORS = {
  bg: '#030303',
  panel: '#080806',
  card: '#11100A',
  cardAlt: '#161306',
  accent: '#D4AF37',
  light: '#FFD966',
  cream: '#FFF4CB',
  muted: '#D0C39A',
  border: 'rgba(255,217,102,0.24)',
  borderStrong: 'rgba(255,217,102,0.48)',
  green: '#3DAA5C',
  red: '#D94444',
}

const ACTIVITY_LABELS: Record<ActivityType, { label: string; emoji: string }> = {
  casual_pints: { label: 'Casual Pints', emoji: '🍻' },
  trad_session: { label: 'Trad Session', emoji: '🎻' },
  quiz_night: { label: 'Quiz Night', emoji: '🧠' },
  sport_watch: { label: 'Sport Watch', emoji: '🏟️' },
  live_music: { label: 'Live Music', emoji: '🎶' },
  after_work: { label: 'After-work Drinks', emoji: '💼' },
  celebration: { label: 'Celebration', emoji: '🎉' },
  other: { label: 'Other', emoji: '✨' },
}

const ACTIVITY_MARKERS: Record<ActivityType | 'pub', { emoji: string; colour: string }> = {
  casual_pints: { emoji: '🍻', colour: '#D4AF37' },
  trad_session: { emoji: '🎻', colour: '#A855F7' },
  quiz_night: { emoji: '🧠', colour: '#2563EB' },
  sport_watch: { emoji: '🏟️', colour: '#16A34A' },
  live_music: { emoji: '🎶', colour: '#EC4899' },
  after_work: { emoji: '💼', colour: '#64748B' },
  celebration: { emoji: '🎉', colour: '#F97316' },
  other: { emoji: '✨', colour: '#38BDF8' },
  pub: { emoji: '🍺', colour: '#D4AF37' },
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All Pubs' },
  { key: 'live_music', label: 'Live Music' },
  { key: 'quiz_night', label: 'Quiz' },
  { key: 'sport_watch', label: 'Sport' },
  { key: 'verified', label: 'Verified Only' },
  { key: 'friends', label: 'Friends Going' },
]

function asNumber(value: string | number | null | undefined) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function radians(value: number) {
  return value * Math.PI / 180
}

function distanceKm(from: { lat: number; lng: number } | null, pub: Pub) {
  if (!from) return null
  const lat2 = asNumber(pub.lat)
  const lng2 = asNumber(pub.lng)
  const dLat = radians(lat2 - from.lat)
  const dLng = radians(lng2 - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}

function walkMinutes(km: number | null) {
  if (km === null) return '—'
  return `${Math.max(1, Math.round((km / 5) * 60))} min walk`
}

function formatKm(km: number | null) {
  if (km === null) return 'Distance pending'
  return `${km < 1 ? km.toFixed(2) : km.toFixed(1)} km`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function HarpLogo({ size = 52 }: { size?: number }) {
  return <div aria-label="FreeTrust pubs harp logo" style={{ width: size, height: Math.round(size * 0.72), borderRadius: Math.max(12, Math.round(size * 0.22)), backgroundImage: `linear-gradient(135deg, rgba(17,16,13,0.12), rgba(17,16,13,0.42)), url(${HARP_LOGO_URL})`, backgroundSize: 'cover', backgroundPosition: 'center', border: `1px solid rgba(241,214,130,0.62)`, boxShadow: '0 10px 30px rgba(0,0,0,0.46), inset 0 0 0 1px rgba(255,244,203,0.12)', flexShrink: 0 }} />
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function interpolateZoomScale(zoom: number, stops: Array<[number, number]>) {
  const sortedStops = stops.slice().sort((a, b) => a[0] - b[0])
  const first = sortedStops[0]
  const last = sortedStops[sortedStops.length - 1]
  if (!first || !last) return 1
  if (zoom <= first[0]) return first[1]
  if (zoom >= last[0]) return last[1]

  for (let index = 1; index < sortedStops.length; index += 1) {
    const previous = sortedStops[index - 1]
    const next = sortedStops[index]
    if (!previous || !next || zoom > next[0]) continue
    const progress = (zoom - previous[0]) / (next[0] - previous[0])
    return previous[1] + (next[1] - previous[1]) * progress
  }

  return last[1]
}

function markerScaleForZoom(zoom: number, selected: boolean) {
  const base = interpolateZoomScale(zoom, [
    [5.2, 0.34],
    [6.5, 0.42],
    [8.2, 0.58],
    [10.2, 0.78],
    [12.4, 0.98],
    [14.6, 1.12],
    [16.2, 1.22],
  ])
  return selected ? base * 1.16 : base
}

function countBadgeVisibleZoom(zoom: number) {
  return zoom >= 9.4
}

function markerStyleForPub(pub: Pub, activities: ActivityRow[]) {
  const nextActivity = activities
    .filter(activity => activity.pub_id === pub.id)
    .slice()
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  return ACTIVITY_MARKERS[nextActivity?.activity_type ?? 'pub'] ?? ACTIVITY_MARKERS.pub
}

function pubTagLabels(pub: Pub) {
  const rawTags = pub.tags?.osm_tags
  const tags = Array.isArray(rawTags)
    ? rawTags
    : rawTags && typeof rawTags === 'object'
      ? [
        rawTags.outdoor_seating === 'yes' || rawTags.outdoor_seating === true ? 'outdoor_seating' : null,
        rawTags.internet_access === 'wlan' || rawTags.wifi === 'yes' || rawTags.wifi === true ? 'wifi' : null,
        rawTags.brewery || rawTags.cask_ale || rawTags.real_ale ? 'brewery_or_cask_tags' : null,
        rawTags.wheelchair === 'yes' ? 'wheelchair_accessible' : null,
        rawTags.wheelchair === 'limited' ? 'wheelchair_limited' : null,
        rawTags.opening_hours ? 'opening_hours_available' : null,
      ].filter((tag): tag is string => Boolean(tag))
      : []
  return Array.from(new Set(tags)).map(tag => ({
    outdoor_seating: 'Outdoor seating',
    wifi: 'Wi‑Fi',
    brewery_or_cask_tags: 'Cask/brewery tags',
    wheelchair_accessible: 'Accessible',
    wheelchair_limited: 'Limited access',
    opening_hours_available: 'Hours listed',
  }[tag] ?? tag.replace(/_/g, ' '))).slice(0, 3)
}

function normalisePubName(name: string) {
  return name
    .toLowerCase()
    .replace(/^the\s+/, '')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '')
}

function profileName(profile?: Profile | null) {
  if (!profile) return 'FreeTrust member'
  return profile.full_name || [profile.first_name, profile.last_name].filter(Boolean).join(' ') || 'FreeTrust member'
}

function startOfFutureInput() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function ExperiencePubsPage() {
  const mapRef = useRef<MapRef | null>(null)
  const mapShellRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pubs, setPubs] = useState<Pub[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [friends, setFriends] = useState<Friend[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('nearby')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [selectedPubId, setSelectedPubId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [inviteContext, setInviteContext] = useState<{ pub: Pub; activity?: ActivityRow | null } | null>(null)
  const [createPub, setCreatePub] = useState<Pub | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [mapZoom, setMapZoom] = useState(14)
  const [restrictedMessage, setRestrictedMessage] = useState<string | null>(null)

  const updateMapZoom = useCallback((zoom: number) => {
    const roundedZoom = Math.round(zoom * 10) / 10
    setMapZoom(currentZoom => currentZoom === roundedZoom ? currentZoom : roundedZoom)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const resizeMap = () => mapRef.current?.resize()
    const frame = window.requestAnimationFrame(resizeMap)
    const quick = window.setTimeout(resizeMap, 80)
    const settled = window.setTimeout(resizeMap, 420)
    window.addEventListener('resize', resizeMap)

    const shell = mapShellRef.current
    const observer = typeof ResizeObserver !== 'undefined' && shell ? new ResizeObserver(resizeMap) : null
    if (observer && shell) observer.observe(shell)

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(quick)
      window.clearTimeout(settled)
      window.removeEventListener('resize', resizeMap)
      observer?.disconnect()
    }
  }, [isMobile, loading, pubs.length])

  const activityCountByPub = useMemo(() => {
    const counts = new Map<string, number>()
    for (const activity of activities) counts.set(activity.pub_id, (counts.get(activity.pub_id) ?? 0) + 1)
    return counts
  }, [activities])

  const displayPubs = useMemo(() => {
    const groups = new Map<string, Pub[]>()
    for (const pub of pubs) {
      const key = normalisePubName(pub.name)
      const group = groups.get(key) ?? []
      group.push(pub)
      groups.set(key, group)
    }
    return Array.from(groups.values()).map(group => group.slice().sort((a, b) => {
      const score = (pub: Pub) => (activityCountByPub.get(pub.id) ?? 0) * 100 + (pub.is_verified ? 20 : 0) + (pub.avg_rating !== null ? 10 : 0) + (pub.address && pub.address !== 'Cork' ? 3 : 0) + (pub.source_url ? 2 : 0)
      return score(b) - score(a)
    })[0]).sort((a, b) => a.name.localeCompare(b.name))
  }, [activityCountByPub, pubs])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/experience-pubs', { cache: 'no-store' })
      const data = await res.json() as { userId?: string | null; pubs?: Pub[]; activities?: ActivityRow[]; invites?: InviteRow[]; friendIds?: string[]; friends?: Friend[]; error?: string; restrictedToIreland?: boolean }
      if (res.status === 403 && data.restrictedToIreland) {
        setRestrictedMessage(data.error ?? PUB_EXPERIENCE_RESTRICTED_MESSAGE)
        setUserId(null)
        setPubs([])
        setActivities([])
        setInvites([])
        setFriendIds(new Set())
        setFriends([])
        return
      }
      if (res.status === 401) {
        setRestrictedMessage(null)
        setUserId(null)
        return
      }
      if (!res.ok) throw new Error(data.error ?? 'Could not load Experience Pubs')
      setRestrictedMessage(null)
      setUserId(data.userId ?? null)
      setPubs(data.pubs ?? [])
      setActivities(data.activities ?? [])
      setInvites(data.invites ?? [])
      setFriendIds(new Set(data.friendIds ?? []))
      setFriends(data.friends ?? [])
    } catch (err) {
      console.error('[ExperiencePubs] loadAll', err)
      showToast('Could not load Experience Pubs just now.')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 51.8985, lng: -8.4756 })
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setLocation(next)
        mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 14, duration: 900 })
      },
      () => setLocation({ lat: 51.8985, lng: -8.4756 }),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    )
  }, [])

  const sortedPubs = useMemo(() => displayPubs
    .map(pub => ({ pub, km: distanceKm(location, pub) }))
    .sort((a, b) => (a.km ?? 9999) - (b.km ?? 9999)), [displayPubs, location])

  const visiblePubRows = useMemo(() => sortedPubs.filter(({ pub }) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'verified') return Boolean(pub.is_verified)
    const pubActivities = activities.filter(activity => activity.pub_id === pub.id)
    if (activeFilter === 'friends') return pubActivities.some(activity => (activity.attendees ?? []).some(a => friendIds.has(a.user_id) && a.status === 'going'))
    return pubActivities.some(activity => activity.activity_type === activeFilter)
  }), [activeFilter, activities, friendIds, sortedPubs])

  const selectedPub = useMemo(() => displayPubs.find(pub => pub.id === selectedPubId) ?? null, [displayPubs, selectedPubId])

  const selectPub = useCallback((pub: Pub) => {
    setSelectedPubId(pub.id)
    setActiveTab('nearby')
    setMobilePanelOpen(true)
    mapRef.current?.flyTo({ center: [asNumber(pub.lng), asNumber(pub.lat)], zoom: 15.3, duration: 700 })
    window.setTimeout(() => cardRefs.current[pub.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
  }, [])

  async function joinActivity(activity: ActivityRow) {
    if (!userId) {
      window.location.href = '/login?redirect=/experience-pubs'
      return
    }
    const count = (activity.attendees ?? []).filter(a => a.status === 'going').length
    if (count >= (activity.max_attendees ?? 20)) return
    const res = await fetch('/api/experience-pubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'joinActivity', activity_id: activity.id }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) showToast(data.error ?? 'Could not join activity')
    else {
      showToast('✅ Going')
      await loadAll()
    }
  }

  async function acceptInvite(invite: InviteRow) {
    if (!userId) return
    const res = await fetch('/api/experience-pubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateInvite', invite_id: invite.id, status: 'accepted' }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) showToast(data.error ?? 'Could not accept invite')
    else {
      showToast('✅ Invite accepted')
      await loadAll()
    }
  }

  async function declineInvite(invite: InviteRow) {
    const res = await fetch('/api/experience-pubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'updateInvite', invite_id: invite.id, status: 'declined' }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) showToast(data.error ?? 'Could not decline invite')
    else {
      setInvites(prev => prev.filter(row => row.id !== invite.id))
      showToast('Invite declined')
    }
  }

  const pageStyle: CSSProperties = {
    minHeight: 'calc(100vh - 104px)',
    background: COLORS.bg,
    color: COLORS.cream,
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    width: '100%',
    maxWidth: '100vw',
    overflowX: 'hidden',
    overflowY: isMobile ? 'visible' : 'hidden',
    position: 'relative',
    paddingBottom: isMobile ? 86 : 0,
    boxSizing: 'border-box',
  }

  const buttonStyle: CSSProperties = {
    border: 'none',
    borderRadius: 999,
    minHeight: 42,
    padding: '10px 14px',
    background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.light})`,
    color: '#050504',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: 13,
  }

  if (!userId && !loading) {
    if (restrictedMessage) {
      return (
        <div style={{ minHeight: 'calc(100vh - 104px)', background: `radial-gradient(circle at 50% 0%, rgba(241,214,130,0.13), transparent 42%), ${COLORS.bg}`, color: COLORS.cream, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
          <section style={{ maxWidth: 460, background: COLORS.panel, border: `1px solid ${COLORS.borderStrong}`, borderRadius: 28, padding: 28, boxShadow: '0 28px 80px rgba(0,0,0,0.45)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><HarpLogo size={92} /></div>
            <h1 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34 }}>Experience Pubs</h1>
            <p style={{ color: COLORS.muted, lineHeight: 1.6 }}>{restrictedMessage}</p>
            <p style={{ color: COLORS.light, fontSize: 13, lineHeight: 1.5, margin: '10px 0 0' }}>If this looks wrong, update your FreeTrust profile location to Ireland or Northern Ireland.</p>
            <a href="/settings" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: 14 }}>Update profile location</a>
          </section>
        </div>
      )
    }
    return (
      <div style={{ minHeight: 'calc(100vh - 104px)', background: `radial-gradient(circle at 50% 0%, rgba(241,214,130,0.13), transparent 42%), ${COLORS.bg}`, color: COLORS.cream, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <section style={{ maxWidth: 440, background: COLORS.panel, border: `1px solid ${COLORS.borderStrong}`, borderRadius: 28, padding: 28, boxShadow: '0 28px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><HarpLogo size={92} /></div>
          <h1 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34 }}>Experience Pubs</h1>
          <p style={{ color: COLORS.muted, lineHeight: 1.6 }}>Sign in to discover pub plans, join trusted members, and invite friends around Cork.</p>
          <a href="/login?redirect=/experience-pubs" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: 10 }}>Sign in to continue</a>
        </section>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <main style={{ flex: isMobile ? '0 0 auto' : 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box' }}>
        <div style={{ padding: isMobile ? '12px 14px 10px' : '14px 16px 12px', background: 'linear-gradient(135deg, rgba(3,3,3,0.98), rgba(18,16,8,0.96))', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 14, minWidth: 0 }}>
            <HarpLogo size={isMobile ? 48 : 64} />
            <div style={{ minWidth: 0 }}>
            <div style={{ color: COLORS.light, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Experience</div>
            <h1 style={{ margin: '2px 0 0', fontFamily: 'Playfair Display, Georgia, serif', fontSize: isMobile ? 31 : 'clamp(24px, 4vw, 38px)', lineHeight: 1, overflowWrap: 'break-word' }}>🍺 Experience Pubs</h1>
            <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{displayPubs.length ? `${displayPubs.length} real Ireland pubs from OpenStreetMap + FreeTrust community` : 'Real Ireland pub map'}</div>
            </div>
          </div>
          <button type="button" onClick={() => setMobilePanelOpen(v => !v)} style={{ ...buttonStyle, display: 'none' }}>Panel</button>
        </div>

        <div ref={mapShellRef} style={{ flex: isMobile ? '0 0 auto' : 1, position: 'relative', minHeight: isMobile ? 300 : 360, height: isMobile ? '42vh' : undefined, maxHeight: isMobile ? 420 : undefined, width: '100%', minWidth: 0, overflow: 'hidden', background: '#050504' }}>
          <MapboxMap
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={MAP_STYLE}
            initialViewState={{ longitude: location?.lng ?? -8.4756, latitude: location?.lat ?? 51.8985, zoom: 14 }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            attributionControl={false}
            onLoad={() => {
              mapRef.current?.resize()
              const zoom = mapRef.current?.getZoom()
              if (typeof zoom === 'number') updateMapZoom(zoom)
            }}
            onMove={event => updateMapZoom(event.viewState.zoom)}
            onError={e => console.error('[ExperiencePubs] map error', e)}
          >
            {visiblePubRows.map(({ pub, km }) => {
              const count = activityCountByPub.get(pub.id) ?? 0
              const selected = selectedPubId === pub.id
              const scale = markerScaleForZoom(mapZoom, selected)
              const marker = markerStyleForPub(pub, activities)
              return (
                <Marker key={pub.id} longitude={asNumber(pub.lng)} latitude={asNumber(pub.lat)} anchor="bottom" onClick={event => { event.originalEvent.stopPropagation(); selectPub(pub) }}>
                  <div style={{ position: 'relative', width: 40, height: 40, cursor: 'pointer', opacity: selected ? 1 : clamp(0.56 + scale * 0.36, 0.56, 0.96), transform: `scale(${scale})`, transformOrigin: '50% 100%', transition: 'transform 180ms ease, opacity 180ms ease' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50% 50% 50% 0', background: `linear-gradient(135deg, ${COLORS.light}, ${marker.colour})`, transform: 'rotate(45deg)', border: '2px solid rgba(255,244,203,0.82)', boxShadow: pub.is_verified ? `0 0 0 3px rgba(61,170,92,0.24), 0 0 15px ${COLORS.green}` : '0 7px 18px rgba(0,0,0,0.38)', display: 'grid', placeItems: 'center' }}>
                      <span style={{ transform: 'rotate(-45deg)', fontSize: 16, lineHeight: 1 }}>{marker.emoji}</span>
                    </div>
                    {count > 0 && countBadgeVisibleZoom(mapZoom) && <span style={{ position: 'absolute', top: -6, right: 0, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: COLORS.red, color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center', fontWeight: 900, border: '2px solid #050504', boxSizing: 'border-box' }}>{count}</span>}
                  </div>
                </Marker>
              )
            })}
            {selectedPub && (
              <Popup longitude={asNumber(selectedPub.lng)} latitude={asNumber(selectedPub.lat)} anchor="bottom" offset={52} closeButton={false} closeOnClick={false} maxWidth="240px">
                <div style={{ background: COLORS.panel, color: COLORS.cream, border: `1px solid ${COLORS.light}`, borderRadius: 16, padding: 12, boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><HarpLogo size={42} /><strong style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16 }}>{selectedPub.name}</strong></div>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{formatKm(distanceKm(location, selectedPub))} · {activityCountByPub.get(selectedPub.id) ?? 0} activities</div>
                  {selectedPub.source_url && <a href={selectedPub.source_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block', color: COLORS.light, fontSize: 11, marginTop: 7, fontWeight: 900, textDecoration: 'none' }}>OpenStreetMap source ↗</a>}
                </div>
              </Popup>
            )}
          </MapboxMap>

          <div style={{ position: 'absolute', left: isMobile ? 10 : 14, right: isMobile ? 10 : 14, bottom: isMobile ? 10 : 14, display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', maxWidth: '100%', zIndex: 4, paddingBottom: isMobile ? 3 : 0, WebkitOverflowScrolling: 'touch' }}>
            {FILTERS.map(filter => (
              <button key={filter.key} type="button" onClick={() => setActiveFilter(filter.key)} style={{ border: `1px solid ${activeFilter === filter.key ? COLORS.light : COLORS.border}`, background: activeFilter === filter.key ? `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.light})` : 'rgba(8,8,6,0.92)', color: activeFilter === filter.key ? '#050504' : COLORS.cream, borderRadius: 999, padding: '9px 12px', fontSize: 12, fontWeight: 850, cursor: 'pointer', minHeight: 38, backdropFilter: 'blur(12px)', flexShrink: 0 }}>{filter.label}</button>
            ))}
          </div>
        </div>
      </main>

      <aside style={{ width: isMobile ? '100%' : mobilePanelOpen ? 360 : 0, maxWidth: '100%', flex: isMobile ? '0 0 auto' : undefined, background: COLORS.panel, borderLeft: isMobile ? 'none' : `1px solid ${COLORS.border}`, borderTop: isMobile ? `1px solid ${COLORS.border}` : 'none', overflow: isMobile ? 'visible' : 'hidden', transition: isMobile ? 'none' : 'width 180ms ease', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ padding: isMobile ? 12 : 14, borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {(['nearby', 'activities', 'invites'] as TabKey[]).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ border: `1px solid ${activeTab === tab ? COLORS.light : COLORS.border}`, background: activeTab === tab ? 'rgba(212,175,55,0.16)' : 'rgba(8,8,6,0.64)', color: activeTab === tab ? COLORS.light : COLORS.muted, borderRadius: 12, padding: '10px 6px', fontSize: 12, fontWeight: 900, cursor: 'pointer', minHeight: 42 }}>
                {tab === 'nearby' ? 'Nearby' : tab === 'activities' ? 'Activities' : `Invites${invites.length ? ` · ${invites.length}` : ''}`}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: isMobile ? '0 0 auto' : 1, overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? '12px 12px 20px' : 14 }}>
          {activeTab === 'nearby' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {loading ? <PanelEmpty text="Loading nearby pubs…" /> : visiblePubRows.map(({ pub, km }) => (
                <PubCard key={pub.id} pub={pub} km={km} selected={selectedPubId === pub.id} activityCount={activityCountByPub.get(pub.id) ?? 0} onClick={() => selectPub(pub)} onInvite={() => setInviteContext({ pub })} onCreate={() => setCreatePub(pub)} setRef={el => { cardRefs.current[pub.id] = el }} />
              ))}
              {!loading && visiblePubRows.length === 0 && <PanelEmpty text="No pubs match that filter yet." />}
            </div>
          )}
          {activeTab === 'activities' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {activities.map(activity => <ActivityCard key={activity.id} activity={activity} userId={userId} onJoin={() => joinActivity(activity)} onInvite={() => activity.pub && setInviteContext({ pub: activity.pub, activity })} />)}
              {activities.length === 0 && <PanelEmpty text="No upcoming pub activities yet." />}
              <button type="button" onClick={() => setCreatePub(selectedPub)} style={{ border: `1.5px dashed ${COLORS.borderStrong}`, background: 'rgba(8,8,6,0.5)', borderRadius: 18, padding: 18, color: COLORS.light, fontWeight: 900, cursor: 'pointer', minHeight: 82 }}>＋ Host your own pub activity</button>
            </div>
          )}
          {activeTab === 'invites' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {invites.map(invite => <InviteCard key={invite.id} invite={invite} onAccept={() => acceptInvite(invite)} onDecline={() => declineInvite(invite)} />)}
              {invites.length === 0 && <PanelEmpty text="No pending pub invites." />}
            </div>
          )}
        </div>
      </aside>

      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: COLORS.green, color: '#fff', borderRadius: 999, padding: '12px 18px', fontWeight: 900, zIndex: 20, boxShadow: '0 18px 48px rgba(0,0,0,0.45)' }}>{toast}</div>}
      {inviteContext && <InviteModal context={inviteContext} activities={activities.filter(a => a.pub_id === inviteContext.pub.id)} friends={friends} userId={userId} onClose={() => setInviteContext(null)} onSent={async () => { setInviteContext(null); showToast('✅ Invites sent via FreeTrust!'); await loadAll() }} />}
      {createPub !== null && <CreateActivityModal pubs={displayPubs} initialPub={createPub} userId={userId} onClose={() => setCreatePub(null)} onCreated={async () => { setCreatePub(null); showToast('🎉 Activity posted to the community!'); await loadAll(); setActiveTab('activities') }} />}
    </div>
  )
}

function PanelEmpty({ text }: { text: string }) {
  return <div style={{ border: `1px solid ${COLORS.border}`, background: 'rgba(0,0,0,0.48)', borderRadius: 18, padding: 18, color: COLORS.muted, textAlign: 'center', lineHeight: 1.5 }}>{text}</div>
}

function PubCard({ pub, km, selected, activityCount, onClick, onInvite, onCreate, setRef }: { pub: Pub; km: number | null; selected: boolean; activityCount: number; onClick: () => void; onInvite: () => void; onCreate: () => void; setRef: (el: HTMLDivElement | null) => void }) {
  const tags = pubTagLabels(pub)
  return (
    <div ref={setRef} onClick={onClick} style={{ background: selected ? COLORS.cardAlt : COLORS.card, border: selected ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14, cursor: 'pointer', boxShadow: selected ? '0 0 0 3px rgba(212,175,55,0.14)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20 }}>{pub.name}</h2>
        {pub.is_verified && <span style={{ color: COLORS.green, fontSize: 16 }}>●</span>}
      </div>
      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{pub.address || 'Cork'} · {formatKm(km)} · {walkMinutes(km)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        {pub.data_source === 'openstreetmap' && <span style={{ borderRadius: 999, padding: '5px 8px', background: 'rgba(241,214,130,0.12)', color: COLORS.light, fontSize: 11, fontWeight: 850 }}>OSM sourced</span>}
        {pub.avg_rating !== null && <span style={{ borderRadius: 999, padding: '5px 8px', background: 'rgba(212,175,55,0.14)', color: COLORS.light, fontSize: 11, fontWeight: 850 }}>★ {asNumber(pub.avg_rating).toFixed(1)}</span>}
        <span style={{ color: COLORS.muted, fontSize: 12 }}>{activityCount} activities</span>
      </div>
      {tags.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{tags.map(tag => <span key={tag} style={{ borderRadius: 999, padding: '4px 7px', background: 'rgba(255,244,203,0.08)', color: COLORS.muted, fontSize: 10, fontWeight: 800 }}>{tag}</span>)}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={event => { event.stopPropagation(); onInvite() }} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, background: 'rgba(0,0,0,0.44)', color: COLORS.light, fontWeight: 900, cursor: 'pointer' }}>Invite Friends</button>
        <button type="button" onClick={event => { event.stopPropagation(); onCreate() }} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: COLORS.accent, color: '#050504', fontWeight: 900, cursor: 'pointer' }}>Create Activity</button>
      </div>
    </div>
  )
}

function ActivityCard({ activity, userId, onJoin, onInvite }: { activity: ActivityRow; userId: string | null; onJoin: () => void; onInvite: () => void }) {
  const attendees = (activity.attendees ?? []).filter(a => a.status === 'going')
  const max = activity.max_attendees ?? 20
  const going = Boolean(userId && attendees.some(a => a.user_id === userId))
  const full = attendees.length >= max
  const type = ACTIVITY_LABELS[activity.activity_type ?? 'other']
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(212,175,55,0.16)', display: 'grid', placeItems: 'center', fontSize: 22 }}>{type.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, color: COLORS.cream }}>{activity.title}</h3>
          <div style={{ color: COLORS.light, fontSize: 12, marginTop: 3 }}>{activity.pub?.name ?? 'Pub'} · {formatDateTime(activity.scheduled_at)}</div>
        </div>
      </div>
      {activity.description && <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.45, margin: '10px 0 0' }}>{activity.description}</p>}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
        <div style={{ color: COLORS.muted, fontSize: 12 }}>{Math.max(0, max - attendees.length)} spots left · {activity.creatorTrust && activity.creatorTrust >= 50 ? <span style={{ color: COLORS.green, fontWeight: 900 }}>Trust verified</span> : profileName(activity.creator)}</div>
        <div style={{ display: 'flex', marginRight: 4 }}>{attendees.slice(0, 4).map((a, idx) => <span key={`${a.user_id}-${idx}`} style={{ width: 24, height: 24, borderRadius: '50%', background: COLORS.accent, marginLeft: idx ? -8 : 0, border: `2px solid ${COLORS.card}`, display: 'grid', placeItems: 'center', fontSize: 10 }}>👤</span>)}{attendees.length > 4 && <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: 4 }}>+{attendees.length - 4}</span>}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <button type="button" disabled={going || full} onClick={onJoin} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: going ? COLORS.green : full ? '#2A2A2A' : COLORS.accent, color: going || full ? '#fff' : '#050504', fontWeight: 900, cursor: going || full ? 'not-allowed' : 'pointer' }}>{going ? '✅ Going' : full ? 'Full' : 'Join Activity'}</button>
        <button type="button" onClick={onInvite} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, background: 'rgba(0,0,0,0.44)', color: COLORS.light, fontWeight: 900, cursor: 'pointer' }}>Invite Friends</button>
      </div>
    </div>
  )
}

function InviteCard({ invite, onAccept, onDecline }: { invite: InviteRow; onAccept: () => void; onDecline: () => void }) {
  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}>
      <div style={{ color: COLORS.light, fontWeight: 900 }}>{profileName(invite.sender)} invited you</div>
      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Trust Score ₮{invite.senderTrust ?? 0}</div>
      <h3 style={{ margin: '10px 0 4px', fontSize: 16 }}>{invite.activity?.title ?? 'Pub plan'}</h3>
      <div style={{ color: COLORS.muted, fontSize: 13 }}>{invite.pub?.name ?? 'Pub'}{invite.activity?.scheduled_at ? ` · ${formatDateTime(invite.activity.scheduled_at)}` : ''}</div>
      {invite.message && <p style={{ color: COLORS.cream, fontSize: 13, lineHeight: 1.45, margin: '10px 0 0' }}>{invite.message}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onAccept} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: COLORS.green, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Accept</button>
        <button type="button" onClick={onDecline} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(0,0,0,0.46)', color: COLORS.muted, fontWeight: 900, cursor: 'pointer' }}>Decline</button>
        <a href={`/messages?to=${invite.from_user_id}`} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, color: COLORS.light, textDecoration: 'none', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>Message</a>
      </div>
    </div>
  )
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.68)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom))', boxSizing: 'border-box', overflowY: 'auto' }}>
      <section role="dialog" aria-modal="true" aria-label={title} style={{ width: 'min(520px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', background: COLORS.panel, color: COLORS.cream, border: `1px solid ${COLORS.borderStrong}`, borderRadius: 24, boxShadow: '0 30px 100px rgba(0,0,0,0.72)', padding: 18, boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: 'rgba(0,0,0,0.62)', color: COLORS.cream, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

const fieldStyle: CSSProperties = { width: '100%', minHeight: 46, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(0,0,0,0.62)', color: COLORS.cream, padding: '10px 12px', fontSize: 16, boxSizing: 'border-box' }
const labelStyle: CSSProperties = { display: 'block', color: COLORS.muted, fontSize: 12, fontWeight: 900, margin: '12px 0 6px' }

function InviteModal({ context, activities, friends, userId, onClose, onSent }: { context: { pub: Pub; activity?: ActivityRow | null }; activities: ActivityRow[]; friends: Friend[]; userId: string | null; onClose: () => void; onSent: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [activityId, setActivityId] = useState(context.activity?.id ?? '')
  const [when, setWhen] = useState(startOfFutureInput())
  const [message, setMessage] = useState(`Join me at ${context.pub.name}?`)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!userId || selected.size === 0 || busy) return
    setBusy(true)
    const chosenActivityId = activityId || null
    const fullMessage = chosenActivityId ? message : `${message}${message.trim() ? '\n' : ''}When: ${formatDateTime(new Date(when).toISOString())}`
    const res = await fetch('/api/experience-pubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendInvites', to_user_ids: Array.from(selected), activity_id: chosenActivityId, pub_id: context.pub.id, message: fullMessage }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) window.alert(data.error ?? 'Could not send invites')
    else onSent()
  }

  return (
    <ModalShell title="Invite Friends" onClose={onClose}>
      <div style={{ color: COLORS.light, fontWeight: 900 }}>{context.pub.name}</div>
      <label style={labelStyle}>Select Friends</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {friends.map(friend => {
          const checked = selected.has(friend.id)
          return <button key={friend.id} type="button" onClick={() => setSelected(prev => { const next = new Set(prev); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next })} style={{ border: `1px solid ${checked ? COLORS.light : COLORS.border}`, background: checked ? 'rgba(212,175,55,0.18)' : 'rgba(0,0,0,0.5)', color: COLORS.cream, borderRadius: 999, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7, minHeight: 42, cursor: 'pointer' }}><span>{friend.avatar_url ? '👤' : '🙂'}</span>{profileName(friend)} · ₮{friend.trust_score}</button>
        })}
        {friends.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13 }}>No mutual friends with Trust Score ≥ 30 found yet.</div>}
      </div>
      <label style={labelStyle}>Activity</label>
      <select value={activityId} onChange={e => setActivityId(e.target.value)} style={fieldStyle}>
        <option value="">New plan (no activity yet)</option>
        {activities.map(activity => <option key={activity.id} value={activity.id}>{activity.title} · {formatDateTime(activity.scheduled_at)}</option>)}
      </select>
      {!activityId && <><label style={labelStyle}>When</label><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={fieldStyle} /></>}
      <label style={labelStyle}>Message</label>
      <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.45 }} />
      <button type="button" onClick={submit} disabled={busy || selected.size === 0} style={{ marginTop: 14, width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: selected.size ? COLORS.accent : '#2A2A2A', color: selected.size ? '#050504' : COLORS.muted, fontWeight: 950, cursor: selected.size ? 'pointer' : 'not-allowed' }}>{busy ? 'Sending…' : 'Send Invites'}</button>
    </ModalShell>
  )
}

function CreateActivityModal({ pubs, initialPub, userId, onClose, onCreated }: { pubs: Pub[]; initialPub: Pub | null; userId: string | null; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('Casual pints')
  const [pubId, setPubId] = useState(initialPub?.id ?? pubs[0]?.id ?? '')
  const [when, setWhen] = useState(startOfFutureInput())
  const [max, setMax] = useState(20)
  const [type, setType] = useState<ActivityType>('casual_pints')
  const [description, setDescription] = useState('')
  const [open, setOpen] = useState(true)
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!userId || !pubId || !title.trim() || busy) return
    const scheduled = new Date(when)
    if (scheduled.getTime() <= Date.now()) {
      window.alert('Choose a future date and time.')
      return
    }
    setBusy(true)
    const res = await fetch('/api/experience-pubs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'createActivity', pub_id: pubId, title: title.trim(), description: description.trim() || null, activity_type: type, scheduled_at: scheduled.toISOString(), max_attendees: max, is_open_to_all: open }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) window.alert(data.error ?? 'Could not create activity')
    else onCreated()
  }

  return (
    <ModalShell title="Create Activity" onClose={onClose}>
      <label style={labelStyle}>Activity Name</label><input value={title} onChange={e => setTitle(e.target.value)} style={fieldStyle} />
      <label style={labelStyle}>Pub</label><select value={pubId} onChange={e => setPubId(e.target.value)} style={fieldStyle}>{pubs.map(pub => <option key={pub.id} value={pub.id}>{pub.name}</option>)}</select>
      <label style={labelStyle}>Date & Time</label><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={fieldStyle} />
      <label style={labelStyle}>Max Attendees</label><input type="number" min={2} max={50} value={max} onChange={e => setMax(Number(e.target.value))} style={fieldStyle} />
      <label style={labelStyle}>Activity Type</label><select value={type} onChange={e => setType(e.target.value as ActivityType)} style={fieldStyle}>{Object.entries(ACTIVITY_LABELS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select>
      <label style={labelStyle}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.45 }} />
      <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={open} onChange={e => setOpen(e.target.checked)} style={{ width: 18, height: 18 }} /> Open to all</label>
      <button type="button" onClick={submit} disabled={busy} style={{ marginTop: 14, width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: COLORS.accent, color: '#050504', fontWeight: 950, cursor: 'pointer' }}>{busy ? 'Posting…' : 'Post Activity'}</button>
    </ModalShell>
  )
}
