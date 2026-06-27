'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import MapboxMap, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

type TabKey = 'discover' | 'activities' | 'invites' | 'mine'
type FilterKey = 'all' | 'today' | 'week' | 'free' | 'beginner' | 'friends' | 'verified'
type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'all'
type AttendanceStatus = 'going' | 'maybe' | 'declined' | 'waitlist'

type Category = { id: string; name: string; emoji: string; colour: string; sort_order: number | null }
type Venue = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  lat: string | number
  lng: string | number
  venue_type: string | null
  facilities: Record<string, unknown> | null
  is_verified: boolean | null
  avg_rating: string | number | null
}
type Profile = { id: string; first_name?: string | null; last_name?: string | null; full_name: string | null; avatar_url: string | null; trust_balance?: number | null; created_at?: string | null }
type Attendee = { id?: string; activity_id: string; user_id: string; status: AttendanceStatus; joined_at?: string | null }
type CommentRow = { id: string; activity_id: string; user_id: string; content: string; created_at: string; user?: Profile | null }
type ActivityRow = {
  id: string
  venue_id: string | null
  created_by: string
  category_id: string | null
  title: string
  description: string | null
  activity_type: string
  skill_level: SkillLevel | null
  scheduled_at: string
  duration_minutes: number | null
  max_attendees: number | null
  min_attendees: number | null
  location_name: string | null
  location_lat: string | number | null
  location_lng: string | number | null
  is_open_to_all: boolean | null
  is_recurring: boolean | null
  recurrence_rule: string | null
  cost_per_person: string | number | null
  equipment_provided: boolean | null
  equipment_notes: string | null
  status: string
  venue?: Venue | null
  category?: Category | null
  attendees?: Attendee[] | null
  creator?: Profile | null
  creatorTrust?: number
  comments?: CommentRow[] | null
}
type InviteRow = { id: string; from_user_id: string; to_user_id: string; activity_id: string; message: string | null; status: string; created_at: string; activity?: ActivityRow | null; sender?: Profile | null; senderTrust?: number }
type Friend = Profile & { trust_score: number }
type MyAttendance = Attendee & { activity?: ActivityRow | null }

const MAP_STYLE = 'mapbox://styles/davos212/cmo7emfe2000x01r3b3cn2zgq'
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
const MOBILE_MAP_MARKER_LIMIT = 220
const MOBILE_DISCOVER_VENUE_LIMIT = 120
const DESKTOP_MAP_MARKER_LIMIT = 900

const COLORS = {
  bg: '#F4FBFF',
  panel: '#FFFFFF',
  card: '#F8FCFF',
  cardAlt: '#EAF6FF',
  amber: '#0EA5E9',
  lightAmber: '#38BDF8',
  cream: '#0F172A',
  muted: '#64748B',
  green: '#0EA770',
  red: '#EF4444',
  border: 'rgba(14,165,233,0.18)',
  borderStrong: 'rgba(14,165,233,0.36)',
}

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'free', label: 'Free Only' },
  { key: 'beginner', label: 'Beginners Welcome' },
  { key: 'friends', label: 'Friends Going' },
  { key: 'verified', label: 'Verified Venues' },
]

const VENUE_ICONS: Record<string, string> = {
  sports_ground: '🏟️', dance_studio: '💃', gym: '🏋️', park: '🌳', community_hall: '🏛️', swimming_pool: '🏊', tennis_court: '🎾', golf_course: '⛳', yoga_studio: '🧘', arts_centre: '🎨', beach: '🏖️', hiking_trail: '🥾', cycling_route: '🚴', other: '📍',
}

const VENUE_CATEGORY_STYLE: Record<string, { emoji: string; colour: string }> = {
  sports_ground: { emoji: '⚽', colour: '#0EA5E9' },
  dance_studio: { emoji: '💃', colour: '#A855F7' },
  gym: { emoji: '🏋️', colour: '#EF4444' },
  park: { emoji: '🌳', colour: '#22C55E' },
  community_hall: { emoji: '🏛️', colour: '#F59E0B' },
  swimming_pool: { emoji: '🏊', colour: '#06B6D4' },
  tennis_court: { emoji: '🎾', colour: '#84CC16' },
  golf_course: { emoji: '⛳', colour: '#15803D' },
  yoga_studio: { emoji: '🧘', colour: '#14B8A6' },
  arts_centre: { emoji: '🎨', colour: '#EC4899' },
  beach: { emoji: '🏖️', colour: '#38BDF8' },
  hiking_trail: { emoji: '🥾', colour: '#92400E' },
  cycling_route: { emoji: '🚴', colour: '#F97316' },
  other: { emoji: '📍', colour: '#64748B' },
}

function asNumber(value: string | number | null | undefined) {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}
function radians(value: number) { return value * Math.PI / 180 }
function distanceKm(from: { lat: number; lng: number } | null, loc?: { lat?: string | number | null; lng?: string | number | null } | null) {
  if (!from || !loc?.lat || !loc?.lng) return null
  const lat2 = asNumber(loc.lat)
  const lng2 = asNumber(loc.lng)
  const dLat = radians(lat2 - from.lat)
  const dLng = radians(lng2 - from.lng)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.lat)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2
  return 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}
function formatKm(km: number | null) { return km === null ? 'Distance pending' : `${km < 1 ? km.toFixed(2) : km.toFixed(1)} km` }
function profileName(profile?: Profile | null) { return profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'FreeTrust member' }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
function formatDateOnly(value: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)) }
function startOfFutureInput() {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return Number.isFinite(r + g + b) ? `rgba(${r},${g},${b},${alpha})` : `rgba(14,165,233,${alpha})`
}
function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)) }
function markerScaleForZoom(zoom: number, selected: boolean) {
  const base = clamp((zoom - 5.4) / 8.2, 0.24, 1)
  return selected ? base * 1.22 : base
}
function categoryForActivity(activity?: ActivityRow | null, categories?: Category[]) { return activity?.category ?? categories?.find(c => c.id === activity?.category_id) ?? null }
function markerStyleForVenue(venue: Venue, activity?: ActivityRow | null, categories?: Category[]) {
  const category = categoryForActivity(activity, categories)
  if (category) return { emoji: category.emoji, colour: category.colour }
  return VENUE_CATEGORY_STYLE[venue.venue_type ?? 'other'] ?? VENUE_CATEGORY_STYLE.other
}
function isUsefulActivityVenueName(name: string) {
  const compact = name.trim().replace(/[^A-Za-zÀ-ÖØ-öø-ÿ0-9]+/g, '')
  const lower = name.toLowerCase()
  return compact.length >= 3 && /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(compact) && !/(^|\b)(disused|abandoned|derelict|proposed|construction)(\b|$)/i.test(lower)
}
function skillLabel(skill?: SkillLevel | null) { return skill === 'beginner' ? 'Beginner' : skill === 'intermediate' ? 'Intermediate' : skill === 'advanced' ? 'Advanced' : 'All Welcome' }
function venueLocation(venue: Venue): { lat: string | number; lng: string | number } { return { lat: venue.lat, lng: venue.lng } }
function activityLocation(activity: ActivityRow) { return activity.venue ? venueLocation(activity.venue) : { lat: activity.location_lat, lng: activity.location_lng } }

export default function ExperienceActivitiesPage() {
  const mapRef = useRef<MapRef | null>(null)
  const mapShellRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [venues, setVenues] = useState<Venue[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set())
  const [myHosting, setMyHosting] = useState<ActivityRow[]>([])
  const [myAttending, setMyAttending] = useState<MyAttendance[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [activeTab, setActiveTab] = useState<TabKey>('discover')
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)
  const [selectedActivity, setSelectedActivity] = useState<ActivityRow | null>(null)
  const [venueFilterId, setVenueFilterId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [createContext, setCreateContext] = useState<{ venue?: Venue | null; activity?: ActivityRow | null } | null>(null)
  const [inviteActivity, setInviteActivity] = useState<ActivityRow | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mapZoom, setMapZoom] = useState(8)

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
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(quick); window.clearTimeout(settled); window.removeEventListener('resize', resizeMap); observer?.disconnect() }
  }, [isMobile, loading, venues.length])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const prefersMobilePayload = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
      const res = await fetch(`/api/experience-activities?mobile=${prefersMobilePayload ? '1' : '0'}`, { cache: 'no-store' })
      const data = await res.json() as { userId?: string | null; venues?: Venue[]; categories?: Category[]; activities?: ActivityRow[]; invites?: InviteRow[]; friends?: Friend[]; friendIds?: string[]; myHosting?: ActivityRow[]; myAttending?: MyAttendance[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not load Experience Activities')
      setUserId(data.userId ?? null)
      setVenues(data.venues ?? [])
      setCategories(data.categories ?? [])
      setActivities(data.activities ?? [])
      setInvites(data.invites ?? [])
      setFriends(data.friends ?? [])
      setFriendIds(new Set(data.friendIds ?? []))
      setMyHosting(data.myHosting ?? [])
      setMyAttending(data.myAttending ?? [])
    } catch (err) {
      console.error('[ExperienceActivities] loadAll', err)
      showToast('Could not load Experience Activities just now.')
    } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { void loadAll() }, [loadAll])

  useEffect(() => {
    if (!activities.length || typeof window === 'undefined') return
    const activityId = new URLSearchParams(window.location.search).get('activity')
    if (!activityId) return
    const activity = activities.find(row => row.id === activityId)
    if (!activity) return
    setSelectedActivity(activity)
    setActiveTab('activities')
    if (activity.venue_id) setVenueFilterId(activity.venue_id)
  }, [activities])

  useEffect(() => {
    if (!navigator.geolocation) { setLocation({ lat: 51.8985, lng: -8.4756 }); return }
    navigator.geolocation.getCurrentPosition(
      pos => { const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setLocation(next); mapRef.current?.flyTo({ center: [next.lng, next.lat], zoom: 13, duration: 900 }) },
      () => setLocation({ lat: 51.8985, lng: -8.4756 }),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 },
    )
  }, [])

  const now = Date.now()
  const todayEnd = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime() }, [])
  const weekEnd = useMemo(() => now + 7 * 24 * 60 * 60 * 1000, [now])
  const activityPassesFilters = useCallback((activity: ActivityRow) => {
    const time = new Date(activity.scheduled_at).getTime()
    if (activeCategoryId && activity.category_id !== activeCategoryId) return false
    if (venueFilterId && activity.venue_id !== venueFilterId) return false
    if (activeFilter === 'today' && time > todayEnd) return false
    if (activeFilter === 'week' && time > weekEnd) return false
    if (activeFilter === 'free' && asNumber(activity.cost_per_person) > 0) return false
    if (activeFilter === 'beginner' && !['beginner', 'all'].includes(activity.skill_level ?? 'all')) return false
    if (activeFilter === 'friends' && !(activity.attendees ?? []).some(a => a.status === 'going' && friendIds.has(a.user_id))) return false
    if (activeFilter === 'verified' && !activity.venue?.is_verified) return false
    return true
  }, [activeCategoryId, activeFilter, friendIds, todayEnd, venueFilterId, weekEnd])

  const filteredActivities = useMemo(() => activities.filter(activityPassesFilters), [activities, activityPassesFilters])
  const venueActivityMap = useMemo(() => {
    const map = new Map<string, ActivityRow[]>()
    for (const activity of filteredActivities) if (activity.venue_id) map.set(activity.venue_id, [...(map.get(activity.venue_id) ?? []), activity])
    return map
  }, [filteredActivities])
  const sortedVenues = useMemo(() => venues.filter(venue => isUsefulActivityVenueName(venue.name)).map(venue => ({ venue, km: distanceKm(location, venueLocation(venue)), count: venueActivityMap.get(venue.id)?.length ?? 0 })).sort((a, b) => (a.km ?? 9999) - (b.km ?? 9999)), [location, venues, venueActivityMap])
  const visibleVenues = useMemo(() => sortedVenues.filter(({ venue, count }) => activeFilter === 'verified' ? Boolean(venue.is_verified) : (activeCategoryId || activeFilter !== 'all') ? count > 0 : true), [activeCategoryId, activeFilter, sortedVenues])
  const mapVenues = useMemo(() => visibleVenues.slice(0, isMobile ? MOBILE_MAP_MARKER_LIMIT : DESKTOP_MAP_MARKER_LIMIT), [isMobile, visibleVenues])
  const discoverVenues = useMemo(() => visibleVenues.slice(0, isMobile ? MOBILE_DISCOVER_VENUE_LIMIT : DESKTOP_MAP_MARKER_LIMIT), [isMobile, visibleVenues])
  const featuredActivities = useMemo(() => filteredActivities.filter(a => new Date(a.scheduled_at).getTime() <= weekEnd).slice(0, 12), [filteredActivities, weekEnd])
  const selectedVenue = useMemo(() => venues.find(venue => venue.id === selectedVenueId) ?? null, [selectedVenueId, venues])

  function dominantActivity(venue: Venue) {
    const venueActivities = venueActivityMap.get(venue.id) ?? []
    if (venueActivities.length === 0) return null
    return venueActivities.slice().sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0]
  }

  function selectVenue(venue: Venue) {
    setSelectedVenueId(venue.id)
    setVenueFilterId(null)
    mapRef.current?.flyTo({ center: [asNumber(venue.lng), asNumber(venue.lat)], zoom: 14.6, duration: 700 })
    window.setTimeout(() => cardRefs.current[venue.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 80)
  }

  async function postAction(payload: Record<string, unknown>, success?: string) {
    const res = await fetch('/api/experience-activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({})) as { error?: string; status?: string }
    if (!res.ok) { showToast(data.error ?? 'Could not update activity'); return data }
    if (success) showToast(success)
    await loadAll()
    return data
  }
  async function joinActivity(activity: ActivityRow) {
    if (!userId) { window.location.href = '/login?redirect=/experience-activities'; return }
    const data = await postAction({ action: 'joinActivity', activity_id: activity.id }, '✅ Activity updated') as { status?: string }
    if (data.status === 'waitlist') showToast('You joined the waitlist')
  }
  async function acceptInvite(invite: InviteRow) { await postAction({ action: 'updateInvite', invite_id: invite.id, status: 'accepted' }, '✅ Invite accepted') }
  async function declineInvite(invite: InviteRow) { await postAction({ action: 'updateInvite', invite_id: invite.id, status: 'declined' }, 'Invite declined') }
  async function addComment(activity: ActivityRow, content: string) { await postAction({ action: 'addComment', activity_id: activity.id, content }, 'Comment posted') }

  const pageStyle: CSSProperties = { minHeight: 'calc(100vh - 104px)', background: `linear-gradient(180deg, #F8FCFF 0%, ${COLORS.bg} 42%, #EAF6FF 100%)`, color: COLORS.cream, display: 'flex', flexDirection: isMobile ? 'column' : 'row', width: '100%', maxWidth: '100vw', overflowX: 'hidden', overflowY: isMobile ? 'visible' : 'hidden', position: 'relative', paddingBottom: isMobile ? 86 : 0, boxSizing: 'border-box' }
  const buttonStyle: CSSProperties = { border: 'none', borderRadius: 999, minHeight: 42, padding: '10px 14px', background: `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.lightAmber})`, color: '#FFFFFF', fontWeight: 900, cursor: 'pointer', fontSize: 13, boxShadow: '0 12px 28px rgba(14,165,233,0.22)' }

  if (!userId && !loading) {
    return <div style={{ minHeight: 'calc(100vh - 104px)', background: `radial-gradient(circle at 50% 0%, rgba(56,189,248,0.22), transparent 42%), ${COLORS.bg}`, color: COLORS.cream, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}><section style={{ maxWidth: 460, background: COLORS.panel, border: `1px solid ${COLORS.borderStrong}`, borderRadius: 28, padding: 28, boxShadow: '0 28px 80px rgba(14,165,233,0.14)' }}><div style={{ fontSize: 54 }}>🏃</div><h1 style={{ margin: '8px 0 0', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 34 }}>Experience Activities</h1><p style={{ color: COLORS.muted, lineHeight: 1.6 }}>Sign in to browse Cork activities, host plans, join trusted members, and invite friends.</p><a href="/login?redirect=/experience-activities" style={{ ...buttonStyle, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', marginTop: 10 }}>Sign in to continue</a></section></div>
  }

  return (
    <div style={pageStyle}>
      <main style={{ flex: isMobile ? '0 0 auto' : 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box' }}>
        <div style={{ padding: isMobile ? '12px 14px 10px' : '14px 16px 12px', background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(224,246,255,0.96))', borderBottom: `1px solid ${COLORS.border}`, boxShadow: '0 10px 30px rgba(14,165,233,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}><div style={{ color: COLORS.amber, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Experience</div><h1 style={{ margin: '2px 0 0', fontFamily: 'Playfair Display, Georgia, serif', fontSize: isMobile ? 31 : 'clamp(24px, 4vw, 38px)', lineHeight: 1 }}>🏃 Experience Activities</h1><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{venues.length ? `${venues.length} activity venues · ${activities.length} upcoming plans` : 'Community activity map'}</div></div>
            <button type="button" onClick={() => setCreateContext({ venue: selectedVenue })} style={{ ...buttonStyle, flexShrink: 0 }}>＋ Host</button>
          </div>
          <CategoryBar categories={categories} activeCategoryId={activeCategoryId} onSelect={id => { setActiveCategoryId(id); setVenueFilterId(null) }} />
        </div>
        <div ref={mapShellRef} style={{ flex: isMobile ? '0 0 auto' : 1, position: 'relative', minHeight: isMobile ? 315 : 360, height: isMobile ? '43vh' : undefined, maxHeight: isMobile ? 440 : undefined, width: '100%', minWidth: 0, overflow: 'hidden', background: '#EAF6FF' }}>
          <MapboxMap ref={mapRef} mapboxAccessToken={MAPBOX_TOKEN} mapStyle={MAP_STYLE} initialViewState={{ longitude: location?.lng ?? -8.4756, latitude: location?.lat ?? 51.8985, zoom: 8 }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} attributionControl={false} onLoad={() => mapRef.current?.resize()} onMove={event => setMapZoom(event.viewState.zoom)} onClick={() => setSelectedVenueId(null)} onError={e => console.error('[ExperienceActivities] map error', e)}>
            {mapVenues.map(({ venue }) => {
              const dominant = dominantActivity(venue)
              const marker = markerStyleForVenue(venue, dominant, categories)
              const count = venueActivityMap.get(venue.id)?.length ?? 0
              const selected = selectedVenueId === venue.id
              const scale = markerScaleForZoom(mapZoom, selected)
              const outer = Math.round(34 * scale)
              const inner = Math.round(30 * scale)
              const iconSize = Math.round(15 * scale)
              const borderWidth = Math.max(1, Math.round(2 * scale))
              return <Marker key={venue.id} longitude={asNumber(venue.lng)} latitude={asNumber(venue.lat)} anchor="bottom" onClick={event => { event.originalEvent.stopPropagation(); selectVenue(venue) }}><div style={{ position: 'relative', width: outer, height: outer, cursor: 'pointer', transition: 'width 160ms ease, height 160ms ease, opacity 160ms ease', opacity: selected ? 1 : clamp(0.62 + scale * 0.38, 0.62, 1) }}><div style={{ width: inner, height: inner, borderRadius: '50% 50% 50% 0', background: `linear-gradient(135deg, ${marker.colour}, ${COLORS.amber})`, transform: 'rotate(45deg)', border: `${borderWidth}px solid rgba(255,255,255,0.9)`, boxShadow: venue.is_verified ? `0 0 0 ${Math.max(1, Math.round(3 * scale))}px rgba(14,167,112,0.18), 0 0 ${Math.round(14 * scale)}px ${COLORS.green}` : `0 ${Math.round(5 * scale)}px ${Math.round(16 * scale)}px rgba(14,165,233,0.20)`, display: 'grid', placeItems: 'center' }}><span style={{ transform: 'rotate(-45deg)', fontSize: iconSize, lineHeight: 1 }}>{marker.emoji}</span></div>{count > 0 && mapZoom >= 10.2 && <span style={{ position: 'absolute', top: -6, right: -6, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999, background: COLORS.red, color: '#fff', fontSize: 10, display: 'grid', placeItems: 'center', fontWeight: 900, border: '2px solid #F4FBFF' }}>{count}</span>}</div></Marker>
            })}
            {selectedVenue && <Popup longitude={asNumber(selectedVenue.lng)} latitude={asNumber(selectedVenue.lat)} anchor="bottom" offset={52} closeButton={false} closeOnClick={false} maxWidth="260px"><div style={{ background: COLORS.panel, color: COLORS.cream, border: `1px solid ${COLORS.lightAmber}`, borderRadius: 16, padding: 12, boxShadow: '0 18px 44px rgba(14,165,233,0.16)' }}><strong style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 17 }}>{selectedVenue.name}</strong><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{formatKm(distanceKm(location, venueLocation(selectedVenue)))} · {venueActivityMap.get(selectedVenue.id)?.length ?? 0} upcoming</div>{(venueActivityMap.get(selectedVenue.id) ?? []).slice(0, 3).map(activity => <div key={activity.id} style={{ color: COLORS.amber, fontSize: 12, marginTop: 6 }}>• {activity.title}</div>)}</div></Popup>}
          </MapboxMap>
          <div style={{ position: 'absolute', left: isMobile ? 10 : 14, right: isMobile ? 10 : 14, bottom: isMobile ? 10 : 14, display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', maxWidth: '100%', zIndex: 4, paddingBottom: isMobile ? 3 : 0, WebkitOverflowScrolling: 'touch' }}>{FILTERS.map(filter => <button key={filter.key} type="button" onClick={() => setActiveFilter(filter.key)} style={{ border: `1px solid ${activeFilter === filter.key ? COLORS.lightAmber : COLORS.border}`, background: activeFilter === filter.key ? `linear-gradient(135deg, ${COLORS.amber}, ${COLORS.lightAmber})` : 'rgba(255,255,255,0.94)', color: activeFilter === filter.key ? '#FFFFFF' : COLORS.cream, borderRadius: 999, padding: '9px 12px', fontSize: 12, fontWeight: 850, cursor: 'pointer', minHeight: 38, backdropFilter: 'blur(12px)', flexShrink: 0, boxShadow: '0 8px 22px rgba(14,165,233,0.12)' }}>{filter.label}</button>)}</div>
        </div>
      </main>
      <aside style={{ width: isMobile ? '100%' : 380, maxWidth: '100%', flex: isMobile ? '0 0 auto' : undefined, background: COLORS.panel, borderLeft: isMobile ? 'none' : `1px solid ${COLORS.border}`, borderTop: isMobile ? `1px solid ${COLORS.border}` : 'none', overflow: isMobile ? 'visible' : 'hidden', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ padding: isMobile ? 12 : 14, borderBottom: `1px solid ${COLORS.border}` }}><div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 7 }}>{(['discover', 'activities', 'invites', 'mine'] as TabKey[]).map(tab => <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ border: `1px solid ${activeTab === tab ? COLORS.lightAmber : COLORS.border}`, background: activeTab === tab ? 'rgba(14,165,233,0.14)' : 'rgba(255,255,255,0.72)', color: activeTab === tab ? COLORS.amber : COLORS.muted, borderRadius: 12, padding: '10px 5px', fontSize: 11, fontWeight: 900, cursor: 'pointer', minHeight: 42 }}>{tab === 'discover' ? 'Discover' : tab === 'activities' ? 'Activities' : tab === 'invites' ? `Invites${invites.length ? ` · ${invites.length}` : ''}` : 'My Activities'}</button>)}</div></div>
        <div style={{ flex: isMobile ? '0 0 auto' : 1, overflowY: isMobile ? 'visible' : 'auto', padding: isMobile ? '12px 12px 20px' : 14 }}>
          {activeTab === 'discover' && <DiscoverTab loading={loading} venues={discoverVenues} activities={featuredActivities} selectedVenueId={selectedVenueId} cardRefs={cardRefs} onSelectVenue={selectVenue} onSeeActivities={venue => { setVenueFilterId(venue.id); setActiveTab('activities') }} onOpenActivity={setSelectedActivity} />}
          {activeTab === 'activities' && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{venueFilterId && <button type="button" onClick={() => setVenueFilterId(null)} style={{ border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.78)', color: COLORS.amber, borderRadius: 999, padding: 10, cursor: 'pointer' }}>Clear venue filter</button>}{filteredActivities.map(activity => <ActivityCard key={activity.id} activity={activity} userId={userId} location={location} onJoin={() => joinActivity(activity)} onInvite={() => setInviteActivity(activity)} onComment={(content) => addComment(activity, content)} onEdit={() => setCreateContext({ activity, venue: activity.venue })} />)}{filteredActivities.length === 0 && <PanelEmpty text="No upcoming community activities match these filters." />}<button type="button" onClick={() => setCreateContext({ venue: selectedVenue })} style={{ border: `1.5px dashed ${COLORS.borderStrong}`, background: 'rgba(255,255,255,0.76)', borderRadius: 18, padding: 18, color: COLORS.amber, fontWeight: 900, cursor: 'pointer', minHeight: 82 }}>＋ Host an Activity</button></div>}
          {activeTab === 'invites' && <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{invites.map(invite => <InviteCard key={invite.id} invite={invite} onAccept={() => acceptInvite(invite)} onDecline={() => declineInvite(invite)} />)}{invites.length === 0 && <PanelEmpty text="No pending activity invites." />}</div>}
          {activeTab === 'mine' && <MyActivitiesTab hosting={myHosting} attending={myAttending} onCancel={activity => { if (window.confirm('Delete this activity? It will be removed from Experience Activities.')) void postAction({ action: 'deleteActivity', activity_id: activity.id }, 'Activity deleted') }} onEdit={activity => setCreateContext({ activity, venue: activity.venue })} onLeave={activityId => postAction({ action: 'leaveActivity', activity_id: activityId }, 'Left activity')} />}
        </div>
      </aside>
      {selectedActivity && <ActivityDetailDrawer activity={selectedActivity} location={location} onClose={() => setSelectedActivity(null)} onJoin={() => joinActivity(selectedActivity)} onInvite={() => setInviteActivity(selectedActivity)} />}
      {toast && <div style={{ position: 'absolute', left: '50%', bottom: 24, transform: 'translateX(-50%)', background: COLORS.green, color: '#fff', borderRadius: 999, padding: '12px 18px', fontWeight: 900, zIndex: 20, boxShadow: '0 18px 48px rgba(14,165,233,0.18)' }}>{toast}</div>}
      {createContext && <CreateActivityModal categories={categories} venues={venues} initialVenue={createContext.venue ?? null} activity={createContext.activity ?? null} userId={userId} onClose={() => setCreateContext(null)} onSaved={async () => { setCreateContext(null); showToast('🎉 Activity live! The community can now find and join it.'); await loadAll(); setActiveTab('activities') }} />}
      {inviteActivity && <InviteModal activity={inviteActivity} friends={friends} userId={userId} onClose={() => setInviteActivity(null)} onSent={async () => { setInviteActivity(null); showToast('✅ Invites sent!'); await loadAll() }} />}
    </div>
  )
}

function CategoryBar({ categories, activeCategoryId, onSelect }: { categories: Category[]; activeCategoryId: string | null; onSelect: (id: string | null) => void }) {
  return <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingTop: 12, WebkitOverflowScrolling: 'touch' }}><button type="button" onClick={() => onSelect(null)} style={{ flexShrink: 0, minHeight: 38, borderRadius: 999, padding: '8px 12px', border: `1px solid ${!activeCategoryId ? COLORS.lightAmber : COLORS.border}`, background: !activeCategoryId ? COLORS.amber : 'rgba(255,255,255,0.82)', color: !activeCategoryId ? '#fff' : COLORS.cream, fontWeight: 900, cursor: 'pointer' }}>All</button>{categories.map(category => { const active = activeCategoryId === category.id; return <button key={category.id} type="button" onClick={() => onSelect(category.id)} style={{ flexShrink: 0, minHeight: 38, borderRadius: 999, padding: '8px 12px', border: `1px solid ${hexToRgba(category.colour, active ? 1 : 0.4)}`, background: active ? category.colour : hexToRgba(category.colour, 0.15), color: active ? '#fff' : COLORS.cream, fontWeight: 900, cursor: 'pointer' }}>{category.emoji} {category.name}</button> })}</div>
}

function PanelEmpty({ text }: { text: string }) { return <div style={{ border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.72)', borderRadius: 18, padding: 18, color: COLORS.muted, textAlign: 'center', lineHeight: 1.5 }}>{text}</div> }

function DiscoverTab({ loading, venues, activities, selectedVenueId, cardRefs, onSelectVenue, onSeeActivities, onOpenActivity }: { loading: boolean; venues: Array<{ venue: Venue; km: number | null; count: number }>; activities: ActivityRow[]; selectedVenueId: string | null; cardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>; onSelectVenue: (venue: Venue) => void; onSeeActivities: (venue: Venue) => void; onOpenActivity: (activity: ActivityRow) => void }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><section><h2 style={{ margin: '0 0 10px', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22 }}>Nearby Venues</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{loading ? <PanelEmpty text="Loading nearby venues…" /> : venues.map(({ venue, km, count }) => <VenueCard key={venue.id} venue={venue} km={km} count={count} selected={selectedVenueId === venue.id} setRef={el => { cardRefs.current[venue.id] = el }} onClick={() => onSelectVenue(venue)} onSeeActivities={() => onSeeActivities(venue)} />)}{!loading && venues.length === 0 && <PanelEmpty text="No venues match that filter yet." />}</div></section><section><h2 style={{ margin: '0 0 10px', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22 }}>Featured This Week</h2><div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>{activities.map(activity => <FeaturedActivity key={activity.id} activity={activity} onClick={() => onOpenActivity(activity)} />)}{activities.length === 0 && <PanelEmpty text="No featured activities yet." />}</div></section></div>
}

function VenueCard({ venue, km, count, selected, setRef, onClick, onSeeActivities }: { venue: Venue; km: number | null; count: number; selected: boolean; setRef: (el: HTMLDivElement | null) => void; onClick: () => void; onSeeActivities: () => void }) {
  return <div ref={setRef} onClick={onClick} style={{ background: selected ? COLORS.cardAlt : COLORS.card, border: selected ? `1px solid ${COLORS.borderStrong}` : `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14, cursor: 'pointer', boxShadow: selected ? '0 0 0 3px rgba(14,165,233,0.16)' : '0 8px 22px rgba(14,165,233,0.06)' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><h3 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20 }}>{VENUE_ICONS[venue.venue_type ?? 'other'] ?? '📍'} {venue.name}</h3>{venue.is_verified && <span style={{ color: COLORS.green, fontSize: 16 }}>●</span>}</div><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{venue.address || venue.city || 'Cork'} · {formatKm(km)}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}><span style={{ borderRadius: 999, padding: '5px 8px', background: 'rgba(56,189,248,0.14)', color: COLORS.amber, fontSize: 11, fontWeight: 850 }}>{count} upcoming</span>{venue.avg_rating !== null && <span style={{ borderRadius: 999, padding: '5px 8px', background: 'rgba(100,116,139,0.08)', color: COLORS.muted, fontSize: 11, fontWeight: 850 }}>★ {asNumber(venue.avg_rating).toFixed(1)}</span>}</div><button type="button" onClick={event => { event.stopPropagation(); onSeeActivities() }} style={{ marginTop: 12, width: '100%', minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, background: 'rgba(255,255,255,0.82)', color: COLORS.amber, fontWeight: 900, cursor: 'pointer' }}>See Activities</button></div>
}

function FeaturedActivity({ activity, onClick }: { activity: ActivityRow; onClick: () => void }) {
  const cat = categoryForActivity(activity)
  const going = (activity.attendees ?? []).filter(a => a.status === 'going').length
  return <button type="button" onClick={onClick} style={{ flex: '0 0 230px', textAlign: 'left', background: COLORS.card, border: `1px solid ${COLORS.border}`, borderLeft: `5px solid ${cat?.colour ?? COLORS.amber}`, borderRadius: 18, padding: 12, color: COLORS.cream, cursor: 'pointer' }}><div style={{ fontSize: 22 }}>{cat?.emoji ?? '✨'}</div><strong style={{ display: 'block', marginTop: 6 }}>{activity.title}</strong><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{activity.venue?.name ?? activity.location_name ?? 'Custom location'}</div><div style={{ color: COLORS.amber, fontSize: 12, marginTop: 5 }}>{formatDateTime(activity.scheduled_at)}</div><div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}><Badge>{going} going</Badge><Badge>{skillLabel(activity.skill_level)}</Badge></div></button>
}

function Badge({ children, tone = 'amber' }: { children: ReactNode; tone?: 'amber' | 'green' | 'muted' }) { return <span style={{ borderRadius: 999, padding: '5px 8px', background: tone === 'green' ? 'rgba(14,167,112,0.14)' : tone === 'muted' ? 'rgba(100,116,139,0.08)' : 'rgba(56,189,248,0.14)', color: tone === 'green' ? COLORS.green : tone === 'muted' ? COLORS.muted : COLORS.amber, fontSize: 11, fontWeight: 850 }}>{children}</span> }

function ActivityCard({ activity, userId, location, onJoin, onInvite, onComment, onEdit }: { activity: ActivityRow; userId: string | null; location: { lat: number; lng: number } | null; onJoin: () => void; onInvite: () => void; onComment: (content: string) => void; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [comment, setComment] = useState('')
  const cat = categoryForActivity(activity)
  const attendees = (activity.attendees ?? []).filter(a => a.status === 'going')
  const max = activity.max_attendees ?? 20
  const going = Boolean(userId && attendees.some(a => a.user_id === userId))
  const waitlist = Boolean(userId && (activity.attendees ?? []).some(a => a.user_id === userId && a.status === 'waitlist'))
  const full = attendees.length >= max
  const km = distanceKm(location, activityLocation(activity))
  return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderLeft: `5px solid ${cat?.colour ?? COLORS.amber}`, borderRadius: 18, padding: 14 }}><div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><div style={{ width: 42, height: 42, borderRadius: 14, background: cat ? hexToRgba(cat.colour, 0.18) : 'rgba(56,189,248,0.16)', display: 'grid', placeItems: 'center', fontSize: 22 }}>{cat?.emoji ?? '✨'}</div><div style={{ flex: 1, minWidth: 0 }}><h3 style={{ margin: 0, fontSize: 16, color: COLORS.cream }}>{activity.title}</h3><div style={{ color: COLORS.amber, fontSize: 12, marginTop: 3 }}>{activity.venue?.name ?? activity.location_name ?? 'Custom location'} · {formatKm(km)}</div></div></div><div style={{ color: COLORS.muted, fontSize: 13, marginTop: 9 }}>{formatDateTime(activity.scheduled_at)} · {activity.duration_minutes ?? 60} min</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}><Badge>{skillLabel(activity.skill_level)}</Badge><Badge>{asNumber(activity.cost_per_person) === 0 ? 'Free' : `€${asNumber(activity.cost_per_person).toFixed(2)} pp`}</Badge>{activity.equipment_provided && <Badge tone="green">Equipment provided</Badge>}{activity.creatorTrust && activity.creatorTrust >= 50 ? <Badge tone="green">✅ Trust verified</Badge> : <Badge tone="muted">{profileName(activity.creator)}</Badge>}{activity.is_recurring && <Badge>Recurring</Badge>}</div><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}><div style={{ color: COLORS.muted, fontSize: 12 }}>{Math.max(0, max - attendees.length)} spots remaining</div><div style={{ display: 'flex', alignItems: 'center' }}>{attendees.slice(0, 4).map((a, idx) => <span key={`${a.user_id}-${idx}`} style={{ width: 24, height: 24, borderRadius: '50%', background: COLORS.amber, marginLeft: idx ? -8 : 0, border: `2px solid ${COLORS.card}`, display: 'grid', placeItems: 'center', fontSize: 10 }}>👤</span>)}{attendees.length > 4 && <span style={{ color: COLORS.muted, fontSize: 12, marginLeft: 4 }}>+{attendees.length - 4}</span>}</div></div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}><button type="button" disabled={going || waitlist} onClick={onJoin} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: going ? COLORS.green : waitlist ? 'rgba(100,116,139,0.18)' : COLORS.amber, color: going || waitlist ? '#fff' : '#FFFFFF', fontWeight: 900, cursor: going || waitlist ? 'not-allowed' : 'pointer' }}>{going ? '✅ Going' : waitlist ? 'Waitlisted' : full ? 'Join Waitlist' : 'Join'}</button><button type="button" onClick={onInvite} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, background: 'rgba(255,255,255,0.82)', color: COLORS.amber, fontWeight: 900, cursor: 'pointer' }}>Invite Friends</button></div><div style={{ display: 'grid', gridTemplateColumns: activity.created_by === userId ? '1fr 1fr' : '1fr', gap: 8, marginTop: 8 }}><button type="button" onClick={() => setExpanded(v => !v)} style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.72)', color: COLORS.muted, fontWeight: 900, cursor: 'pointer' }}>{expanded ? 'Hide details' : `Comments (${activity.comments?.length ?? 0})`}</button>{activity.created_by === userId && <button type="button" onClick={onEdit} style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.72)', color: COLORS.amber, fontWeight: 900, cursor: 'pointer' }}>Edit</button>}</div>{expanded && <div style={{ marginTop: 12, borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>{activity.description && <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5, margin: '0 0 10px' }}>{activity.description}</p>}{activity.equipment_notes && <p style={{ color: COLORS.muted, fontSize: 13, lineHeight: 1.5 }}>Equipment: {activity.equipment_notes}</p>}<CommentThread comments={activity.comments ?? []} />{userId && <form onSubmit={event => { event.preventDefault(); if (comment.trim()) { onComment(comment); setComment('') } }} style={{ display: 'flex', gap: 8, marginTop: 10 }}><input value={comment} onChange={e => setComment(e.target.value)} placeholder="Add a comment" style={{ ...fieldStyle, minHeight: 42, flex: 1 }} /><button type="submit" style={{ minHeight: 42, borderRadius: 12, border: 'none', background: COLORS.amber, color: '#FFFFFF', fontWeight: 900, padding: '0 12px' }}>Post</button></form>}</div>}</div>
}

function CommentThread({ comments }: { comments: CommentRow[] }) { return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{comments.map(comment => <div key={comment.id} style={{ background: 'rgba(224,246,255,0.72)', borderRadius: 12, padding: 10 }}><div style={{ color: COLORS.amber, fontSize: 12, fontWeight: 900 }}>{profileName(comment.user)} · {formatDateOnly(comment.created_at)}</div><div style={{ color: COLORS.cream, fontSize: 13, marginTop: 4, lineHeight: 1.4 }}>{comment.content}</div></div>)}{comments.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13 }}>No comments yet.</div>}</div> }

function InviteCard({ invite, onAccept, onDecline }: { invite: InviteRow; onAccept: () => void; onDecline: () => void }) { const activity = invite.activity; const cat = categoryForActivity(activity); return <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}><div style={{ color: COLORS.amber, fontWeight: 900 }}>{profileName(invite.sender)} invited you</div><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Trust Score ₮{invite.senderTrust ?? 0}</div><h3 style={{ margin: '10px 0 4px', fontSize: 16 }}>{cat?.emoji ?? '✨'} {activity?.title ?? 'Community activity'}</h3><div style={{ color: COLORS.muted, fontSize: 13 }}>{activity?.venue?.name ?? activity?.location_name ?? 'Venue'}{activity?.scheduled_at ? ` · ${formatDateTime(activity.scheduled_at)}` : ''}</div>{invite.message && <p style={{ color: COLORS.cream, fontSize: 13, lineHeight: 1.45, margin: '10px 0 0' }}>{invite.message}</p>}<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}><button type="button" onClick={onAccept} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: COLORS.green, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Accept</button><button type="button" onClick={onDecline} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.72)', color: COLORS.muted, fontWeight: 900, cursor: 'pointer' }}>Decline</button><a href={`/messages?to=${invite.from_user_id}`} style={{ minHeight: 40, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, color: COLORS.amber, textDecoration: 'none', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>Message</a></div></div> }

function MyActivitiesTab({ hosting, attending, onCancel, onEdit, onLeave }: { hosting: ActivityRow[]; attending: MyAttendance[]; onCancel: (activity: ActivityRow) => void; onEdit: (activity: ActivityRow) => void; onLeave: (activityId: string) => void }) { return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><section><h2 style={{ margin: '0 0 10px', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22 }}>Hosting</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{hosting.map(activity => <div key={activity.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12 }}><strong>{activity.title}</strong><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{formatDateTime(activity.scheduled_at)} · {(activity.attendees ?? []).filter(a => a.status === 'going').length} attendees</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}><button type="button" onClick={() => onEdit(activity)} style={{ minHeight: 38, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, background: 'rgba(255,255,255,0.72)', color: COLORS.amber, fontWeight: 900 }}>Edit</button><button type="button" onClick={() => onCancel(activity)} style={{ minHeight: 38, borderRadius: 12, border: `1px solid rgba(217,68,68,0.42)`, background: 'rgba(217,68,68,0.12)', color: '#B91C1C', fontWeight: 900, cursor: 'pointer' }}>Delete</button></div></div>)}{hosting.length === 0 && <PanelEmpty text="You are not hosting any active activities yet." />}</div></section><section><h2 style={{ margin: '0 0 10px', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 22 }}>Attending</h2><div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{attending.map(row => row.activity ? <div key={row.id ?? row.activity_id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 12 }}><strong>{row.activity.title}</strong><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 5 }}>{formatDateTime(row.activity.scheduled_at)} · {skillLabel(row.activity.skill_level)}</div><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 10 }}><Badge>{row.status === 'waitlist' ? 'Waitlist' : row.status === 'maybe' ? 'Maybe' : 'Going'}</Badge><button type="button" onClick={() => onLeave(row.activity_id)} style={{ minHeight: 36, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.72)', color: COLORS.muted, fontWeight: 900 }}>Leave</button></div></div> : null)}{attending.length === 0 && <PanelEmpty text="Activities you join will appear here." />}</div></section></div> }

function ActivityDetailDrawer({ activity, location, onClose, onJoin, onInvite }: { activity: ActivityRow; location: { lat: number; lng: number } | null; onClose: () => void; onJoin: () => void; onInvite: () => void }) { const cat = categoryForActivity(activity); return <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(255,255,255,0.94)', display: 'flex', justifyContent: 'flex-end' }}><section style={{ width: 'min(100%, 380px)', height: '100%', background: COLORS.panel, borderLeft: `1px solid ${COLORS.borderStrong}`, padding: 18, overflowY: 'auto', boxSizing: 'border-box' }}><button type="button" onClick={onClose} style={{ float: 'right', width: 40, height: 40, borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.88)', color: COLORS.cream, fontSize: 18 }}>×</button><div style={{ fontSize: 36 }}>{cat?.emoji ?? '✨'}</div><h2 style={{ margin: '8px 0 4px', fontFamily: 'Playfair Display, Georgia, serif', fontSize: 30 }}>{activity.title}</h2><div style={{ color: COLORS.amber }}>{activity.venue?.name ?? activity.location_name ?? 'Custom location'} · {formatKm(distanceKm(location, activityLocation(activity)))}</div><p style={{ color: COLORS.muted, lineHeight: 1.55 }}>{activity.description || 'No description added yet.'}</p><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Badge>{formatDateTime(activity.scheduled_at)}</Badge><Badge>{skillLabel(activity.skill_level)}</Badge><Badge>{asNumber(activity.cost_per_person) === 0 ? 'Free' : `€${asNumber(activity.cost_per_person).toFixed(2)} pp`}</Badge></div><section style={{ marginTop: 16, background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 18, padding: 14 }}><h3 style={{ margin: 0 }}>Organiser</h3><div style={{ color: COLORS.cream, marginTop: 8 }}>{profileName(activity.creator)}</div><div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Trust Score ₮{activity.creatorTrust ?? 0}{activity.creator?.created_at ? ` · member since ${formatDateOnly(activity.creator.created_at)}` : ''}</div></section><section style={{ marginTop: 16 }}><h3>Attendees</h3><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(activity.attendees ?? []).map(row => <Badge key={row.user_id}>{row.status === 'waitlist' ? 'Waitlist' : 'Going'} 👤</Badge>)}</div></section>{activity.equipment_notes && <p style={{ color: COLORS.muted }}>Equipment: {activity.equipment_notes}</p>}{activity.is_recurring && <p style={{ color: COLORS.muted }}>Recurring: {activity.recurrence_rule ?? 'Recurring schedule'}</p>}<CommentThread comments={activity.comments ?? []} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 16 }}><button type="button" onClick={onJoin} style={{ minHeight: 42, borderRadius: 12, border: 'none', background: COLORS.amber, color: '#FFFFFF', fontWeight: 900 }}>Join</button><button type="button" onClick={onInvite} style={{ minHeight: 42, borderRadius: 12, border: `1px solid ${COLORS.borderStrong}`, background: 'transparent', color: COLORS.amber, fontWeight: 900 }}>Invite</button><button type="button" onClick={() => navigator.share?.({ title: activity.title, url: window.location.href })} style={{ minHeight: 42, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'transparent', color: COLORS.muted, fontWeight: 900 }}>Share</button></div><button type="button" style={{ marginTop: 10, width: '100%', minHeight: 40, borderRadius: 12, border: `1px solid rgba(217,68,68,0.42)`, background: 'rgba(217,68,68,0.1)', color: '#FFB0B0', fontWeight: 900 }}>Report</button></section></div> }

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous } }, []); return <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.26)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'max(14px, env(safe-area-inset-top)) 14px max(14px, env(safe-area-inset-bottom))', boxSizing: 'border-box', overflowY: 'auto' }}><section role="dialog" aria-modal="true" aria-label={title} style={{ width: 'min(560px, calc(100vw - 28px))', maxHeight: 'calc(100dvh - 28px)', overflowY: 'auto', background: COLORS.panel, color: COLORS.cream, border: `1px solid ${COLORS.borderStrong}`, borderRadius: 24, boxShadow: '0 30px 100px rgba(14,165,233,0.18)', padding: 18, boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}><h2 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26 }}>{title}</h2><button type="button" onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.82)', color: COLORS.cream, cursor: 'pointer', fontSize: 18 }}>×</button></div>{children}</section></div> }

const fieldStyle: CSSProperties = { width: '100%', minHeight: 46, borderRadius: 12, border: `1px solid ${COLORS.border}`, background: 'rgba(255,255,255,0.94)', color: COLORS.cream, padding: '10px 12px', fontSize: 16, boxSizing: 'border-box' }
const labelStyle: CSSProperties = { display: 'block', color: COLORS.muted, fontSize: 12, fontWeight: 900, margin: '12px 0 6px' }

function CreateActivityModal({ categories, venues, initialVenue, activity, userId, onClose, onSaved }: { categories: Category[]; venues: Venue[]; initialVenue: Venue | null; activity: ActivityRow | null; userId: string | null; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(activity?.title ?? '')
  const [categoryId, setCategoryId] = useState(activity?.category_id ?? categories[0]?.id ?? '')
  const [activityType, setActivityType] = useState(activity?.activity_type ?? '')
  const [venueId, setVenueId] = useState(activity?.venue_id ?? initialVenue?.id ?? venues[0]?.id ?? '')
  const [custom, setCustom] = useState(!activity?.venue_id && Boolean(activity?.location_name))
  const [locationName, setLocationName] = useState(activity?.location_name ?? '')
  const [when, setWhen] = useState(activity?.scheduled_at ? activity.scheduled_at.slice(0, 16) : startOfFutureInput())
  const [duration, setDuration] = useState(activity?.duration_minutes ?? 60)
  const [skill, setSkill] = useState<SkillLevel>(activity?.skill_level ?? 'all')
  const [max, setMax] = useState(activity?.max_attendees ?? 20)
  const [min, setMin] = useState(activity?.min_attendees ?? 2)
  const [cost, setCost] = useState(asNumber(activity?.cost_per_person))
  const [equipment, setEquipment] = useState(Boolean(activity?.equipment_provided))
  const [equipmentNotes, setEquipmentNotes] = useState(activity?.equipment_notes ?? '')
  const [recurring, setRecurring] = useState(Boolean(activity?.is_recurring))
  const [recurrence, setRecurrence] = useState(activity?.recurrence_rule ?? 'Weekly')
  const [open, setOpen] = useState(activity?.is_open_to_all ?? true)
  const [description, setDescription] = useState(activity?.description ?? '')
  const [busy, setBusy] = useState(false)
  async function submit() {
    if (!userId || !title.trim() || !categoryId || !activityType.trim() || busy) return
    const scheduled = new Date(when)
    if (scheduled.getTime() <= Date.now()) { window.alert('Choose a future date and time.'); return }
    const selectedVenue = venues.find(v => v.id === venueId)
    setBusy(true)
    const res = await fetch('/api/experience-activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: activity ? 'updateActivity' : 'createActivity', activity_id: activity?.id, title, category_id: categoryId, activity_type: activityType, venue_id: custom ? null : venueId, scheduled_at: scheduled.toISOString(), duration_minutes: duration, skill_level: skill, max_attendees: max, min_attendees: min, cost_per_person: cost, equipment_provided: equipment, equipment_notes: equipment ? equipmentNotes : null, is_recurring: recurring, recurrence_rule: recurring ? recurrence : null, is_open_to_all: open, description, location_name: custom ? locationName : selectedVenue?.name, location_lat: custom ? null : selectedVenue?.lat, location_lng: custom ? null : selectedVenue?.lng }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) window.alert(data.error ?? 'Could not save activity')
    else onSaved()
  }
  return <ModalShell title={activity ? 'Edit Activity' : 'Host an Activity'} onClose={onClose}><label style={labelStyle}>Title</label><input value={title} onChange={e => setTitle(e.target.value)} style={fieldStyle} /><label style={labelStyle}>Category</label><select value={categoryId} onChange={e => setCategoryId(e.target.value)} style={fieldStyle}>{categories.map(category => <option key={category.id} value={category.id}>{category.emoji} {category.name}</option>)}</select><label style={labelStyle}>Activity Type</label><input value={activityType} onChange={e => setActivityType(e.target.value)} placeholder="5-a-side Football, Salsa Beginners, Park Run" style={fieldStyle} /><label style={labelStyle}>Venue</label><select value={custom ? 'custom' : venueId} onChange={e => { setCustom(e.target.value === 'custom'); if (e.target.value !== 'custom') setVenueId(e.target.value) }} style={fieldStyle}><option value="custom">Custom Location</option>{venues.map(venue => <option key={venue.id} value={venue.id}>{venue.name}</option>)}</select>{custom && <><label style={labelStyle}>Custom location</label><input value={locationName} onChange={e => setLocationName(e.target.value)} style={fieldStyle} /></>}<label style={labelStyle}>Date & Time</label><input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={fieldStyle} /><label style={labelStyle}>Duration</label><select value={duration} onChange={e => setDuration(Number(e.target.value))} style={fieldStyle}><option value={30}>30 min</option><option value={60}>1 hr</option><option value={90}>1.5 hr</option><option value={120}>2 hr</option><option value={240}>Half day</option><option value={480}>Full day</option></select><label style={labelStyle}>Skill Level</label><select value={skill} onChange={e => setSkill(e.target.value as SkillLevel)} style={fieldStyle}><option value="all">All Welcome</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><div><label style={labelStyle}>Max Attendees</label><input type="number" min={2} max={100} value={max} onChange={e => setMax(Number(e.target.value))} style={fieldStyle} /></div><div><label style={labelStyle}>Min Attendees</label><input type="number" min={1} max={100} value={min} onChange={e => setMin(Number(e.target.value))} style={fieldStyle} /></div></div><label style={labelStyle}>Cost per person</label><input type="number" min={0} step="0.01" value={cost} onChange={e => setCost(Number(e.target.value))} style={fieldStyle} /><Toggle checked={equipment} onChange={setEquipment}>Equipment provided</Toggle>{equipment && <><label style={labelStyle}>Equipment notes</label><textarea value={equipmentNotes} onChange={e => setEquipmentNotes(e.target.value)} rows={3} style={{ ...fieldStyle, resize: 'vertical' }} /></>}<Toggle checked={recurring} onChange={setRecurring}>Recurring</Toggle>{recurring && <select value={recurrence} onChange={e => setRecurrence(e.target.value)} style={fieldStyle}><option>Weekly</option><option>Fortnightly</option><option>Monthly</option></select>}<Toggle checked={open} onChange={setOpen}>Open to all</Toggle><label style={labelStyle}>Description</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.45 }} /><button type="button" onClick={submit} disabled={busy} style={{ marginTop: 14, width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: COLORS.amber, color: '#FFFFFF', fontWeight: 950, cursor: 'pointer' }}>{busy ? 'Saving…' : activity ? 'Save Changes' : 'Post Activity'}</button></ModalShell>
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: ReactNode }) { return <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 10 }}><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18 }} /> {children}</label> }

function InviteModal({ activity, friends, userId, onClose, onSent }: { activity: ActivityRow; friends: Friend[]; userId: string | null; onClose: () => void; onSent: () => void }) { const [selected, setSelected] = useState<Set<string>>(new Set()); const [message, setMessage] = useState(`Join me for ${activity.title}?`); const [busy, setBusy] = useState(false); async function submit() { if (!userId || selected.size === 0 || busy) return; setBusy(true); const res = await fetch('/api/experience-activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'sendInvites', to_user_ids: Array.from(selected), activity_id: activity.id, message }) }); const data = await res.json().catch(() => ({})) as { error?: string }; setBusy(false); if (!res.ok) window.alert(data.error ?? 'Could not send invites'); else onSent() } return <ModalShell title="Invite Friends" onClose={onClose}><div style={{ color: COLORS.amber, fontWeight: 900 }}>{activity.title}</div><label style={labelStyle}>Select Friends</label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{friends.map(friend => { const checked = selected.has(friend.id); return <button key={friend.id} type="button" onClick={() => setSelected(prev => { const next = new Set(prev); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next })} style={{ border: `1px solid ${checked ? COLORS.lightAmber : COLORS.border}`, background: checked ? 'rgba(14,165,233,0.16)' : 'rgba(255,255,255,0.76)', color: COLORS.cream, borderRadius: 999, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7, minHeight: 42, cursor: 'pointer' }}>🙂 {profileName(friend)} · ₮{friend.trust_score}</button> })}{friends.length === 0 && <div style={{ color: COLORS.muted, fontSize: 13 }}>No mutual friends with Trust Score ≥ 30 found yet.</div>}</div><label style={labelStyle}>Message</label><textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.45 }} /><button type="button" onClick={submit} disabled={busy || selected.size === 0} style={{ marginTop: 14, width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: selected.size ? COLORS.amber : 'rgba(100,116,139,0.18)', color: selected.size ? '#FFFFFF' : COLORS.muted, fontWeight: 950, cursor: selected.size ? 'pointer' : 'not-allowed' }}>{busy ? 'Sending…' : 'Send Invites'}</button></ModalShell> }
