'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import MapboxMap, { Marker, Popup, type MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'

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

const COLORS = {
  bg: '#1A1008',
  panel: '#2D1F0F',
  card: '#352512',
  accent: '#C97D2E',
  light: '#E8A84B',
  cream: '#F5EDD6',
  muted: '#A0927A',
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

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const activityCountByPub = useMemo(() => {
    const counts = new Map<string, number>()
    for (const activity of activities) counts.set(activity.pub_id, (counts.get(activity.pub_id) ?? 0) + 1)
    return counts
  }, [activities])

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/experience-pubs', { cache: 'no-store' })
      const data = await res.json() as { userId?: string | null; pubs?: Pub[]; activities?: ActivityRow[]; invites?: InviteRow[]; friendIds?: string[]; friends?: Friend[]; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Could not load Experience Pubs')
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

  const sortedPubs = useMemo(() => pubs
    .map(pub => ({ pub, km: distanceKm(location, pub) }))
    .sort((a, b) => (a.km ?? 9999) - (b.km ?? 9999)), [location, pubs])

  const visiblePubRows = useMemo(() => sortedPubs.filter(({ pub }) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'verified') return Boolean(pub.is_verified)
    const pubActivities = activities.filter(activity => activity.pub_id === pub.id)
    if (activeFilter === 'friends') return pubActivities.some(activity => (activity.attendees ?? []).some(a => friendIds.has(a.user_id) && a.status === 'going'))
    return pubActivities.some(activity => activity.activity_type === activeFilter)
  }), [activeFilter, activities, friendIds, sortedPubs])

  const selectedPub = useMemo(() => pubs.find(pub => pub.id === selectedPubId) ?? null, [pubs, selectedPubId])

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
    color: '#1A1008',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: 13,
  }

  if (!userId && !loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 104px)', background: COLORS.bg, color: COLORS.cream, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <section style={{ maxWidth: 440, background: COLORS.panel, border: `1px solid rgba(201,125,46,0.25)`, borderRadius: 28, padding: 28, boxShadow: '0 28px 80px rgba(0,0,0,0.45)' }}>
          <div style={{ fontSize: 46, marginBottom: 14 }}>🍺</div>
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
        <div style={{ padding: isMobile ? '12px 14px 10px' : '14px 16px 12px', background: 'rgba(26,16,8,0.92)', borderBottom: '1px solid rgba(201,125,46,0.16)', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', gap: 12, boxSizing: 'border-box' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: COLORS.light, fontSize: 12, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Experience</div>
            <h1 style={{ margin: '2px 0 0', fontFamily: 'Playfair Display, Georgia, serif', fontSize: isMobile ? 31 : 'clamp(24px, 4vw, 38px)', lineHeight: 1, overflowWrap: 'break-word' }}>🍺 Experience Pubs</h1>
          </div>
          <button type="button" onClick={() => setMobilePanelOpen(v => !v)} style={{ ...buttonStyle, display: 'none' }}>Panel</button>
        </div>

        <div style={{ flex: isMobile ? '0 0 auto' : 1, position: 'relative', minHeight: isMobile ? 300 : 360, height: isMobile ? '42vh' : undefined, maxHeight: isMobile ? 420 : undefined, width: '100%', overflow: 'hidden' }}>
          <MapboxMap
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={MAP_STYLE}
            initialViewState={{ longitude: location?.lng ?? -8.4756, latitude: location?.lat ?? 51.8985, zoom: 14 }}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
            onError={e => console.error('[ExperiencePubs] map error', e)}
          >
            {visiblePubRows.map(({ pub, km }) => {
              const count = activityCountByPub.get(pub.id) ?? 0
              const selected = selectedPubId === pub.id
              return (
                <Marker key={pub.id} longitude={asNumber(pub.lng)} latitude={asNumber(pub.lat)} anchor="bottom" onClick={event => { event.originalEvent.stopPropagation(); selectPub(pub) }}>
                  <div style={{ position: 'relative', width: 44, height: 44, transform: selected ? 'scale(1.2)' : 'scale(1)', transition: 'transform 160ms ease', cursor: 'pointer' }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50% 50% 50% 0', background: COLORS.accent, transform: 'rotate(45deg)', border: `2px solid ${COLORS.light}`, boxShadow: pub.is_verified ? `0 0 0 4px rgba(61,170,92,0.24), 0 0 22px ${COLORS.green}` : '0 8px 24px rgba(0,0,0,0.45)', display: 'grid', placeItems: 'center' }}>
                      <span style={{ transform: 'rotate(-45deg)', fontSize: 19 }}>🍺</span>
                    </div>
                    {count > 0 && <span style={{ position: 'absolute', top: -7, right: -6, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 999, background: COLORS.red, color: '#fff', fontSize: 11, display: 'grid', placeItems: 'center', fontWeight: 900, border: '2px solid #1A1008' }}>{count}</span>}
                  </div>
                </Marker>
              )
            })}
            {selectedPub && (
              <Popup longitude={asNumber(selectedPub.lng)} latitude={asNumber(selectedPub.lat)} anchor="bottom" offset={52} closeButton={false} closeOnClick={false} maxWidth="240px">
                <div style={{ background: COLORS.panel, color: COLORS.cream, border: `1px solid ${COLORS.accent}`, borderRadius: 16, padding: 12, boxShadow: '0 18px 44px rgba(0,0,0,0.45)' }}>
                  <strong style={{ fontFamily: 'Playfair Display, Georgia, serif', fontSize: 16 }}>{selectedPub.name}</strong>
                  <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>{formatKm(distanceKm(location, selectedPub))} · {activityCountByPub.get(selectedPub.id) ?? 0} activities</div>
                </div>
              </Popup>
            )}
          </MapboxMap>

          <div style={{ position: 'absolute', left: isMobile ? 10 : 14, right: isMobile ? 10 : 14, bottom: isMobile ? 10 : 14, display: 'flex', gap: 8, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : 'visible', maxWidth: '100%', zIndex: 4, paddingBottom: isMobile ? 3 : 0, WebkitOverflowScrolling: 'touch' }}>
            {FILTERS.map(filter => (
              <button key={filter.key} type="button" onClick={() => setActiveFilter(filter.key)} style={{ border: `1px solid ${activeFilter === filter.key ? COLORS.light : 'rgba(245,237,214,0.2)'}`, background: activeFilter === filter.key ? 'rgba(201,125,46,0.92)' : 'rgba(45,31,15,0.9)', color: activeFilter === filter.key ? '#1A1008' : COLORS.cream, borderRadius: 999, padding: '9px 12px', fontSize: 12, fontWeight: 850, cursor: 'pointer', minHeight: 38, backdropFilter: 'blur(12px)', flexShrink: 0 }}>{filter.label}</button>
            ))}
          </div>
        </div>
      </main>

      <aside style={{ width: isMobile ? '100%' : mobilePanelOpen ? 360 : 0, maxWidth: '100%', flex: isMobile ? '0 0 auto' : undefined, background: COLORS.panel, borderLeft: isMobile ? 'none' : '1px solid rgba(201,125,46,0.2)', borderTop: isMobile ? '1px solid rgba(201,125,46,0.2)' : 'none', overflow: isMobile ? 'visible' : 'hidden', transition: isMobile ? 'none' : 'width 180ms ease', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        <div style={{ padding: isMobile ? 12 : 14, borderBottom: '1px solid rgba(201,125,46,0.16)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {(['nearby', 'activities', 'invites'] as TabKey[]).map(tab => (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} style={{ border: `1px solid ${activeTab === tab ? COLORS.accent : 'rgba(245,237,214,0.14)'}`, background: activeTab === tab ? 'rgba(201,125,46,0.18)' : 'rgba(26,16,8,0.54)', color: activeTab === tab ? COLORS.light : COLORS.muted, borderRadius: 12, padding: '10px 6px', fontSize: 12, fontWeight: 900, cursor: 'pointer', minHeight: 42 }}>
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
              <button type="button" onClick={() => setCreatePub(selectedPub)} style={{ border: `1.5px dashed rgba(201,125,46,0.55)`, background: 'rgba(26,16,8,0.38)', borderRadius: 18, padding: 18, color: COLORS.light, fontWeight: 900, cursor: 'pointer', minHeight: 82 }}>＋ Host your own pub activity</button>
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
      {createPub !== null && <CreateActivityModal pubs={pubs} initialPub={createPub} userId={userId} onClose={() => setCreatePub(null)} onCreated={async () => { setCreatePub(null); showToast('🎉 Activity posted to the community!'); await loadAll(); setActiveTab('activities') }} />}
    </div>
  )
}

function PanelEmpty({ text }: { text: string }) {
  return <div style={{ border: '1px solid rgba(245,237,214,0.12)', background: 'rgba(26,16,8,0.38)', borderRadius: 18, padding: 18, color: COLORS.muted, textAlign: 'center', lineHeight: 1.5 }}>{text}</div>
}

function PubCard({ pub, km, selected, activityCount, onClick, onInvite, onCreate, setRef }: { pub: Pub; km: number | null; selected: boolean; activityCount: number; onClick: () => void; onInvite: () => void; onCreate: () => void; setRef: (el: HTMLDivElement | null) => void }) {
  return (
    <div ref={setRef} onClick={onClick} style={{ background: COLORS.card, border: selected ? '1px solid rgba(201,125,46,0.5)' : '1px solid rgba(245,237,214,0.1)', borderRadius: 18, padding: 14, cursor: 'pointer', boxShadow: selected ? '0 0 0 3px rgba(201,125,46,0.14)' : 'none' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <h2 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 20 }}>{pub.name}</h2>
        {pub.is_verified && <span style={{ color: COLORS.green, fontSize: 16 }}>●</span>}
      </div>
      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 6, lineHeight: 1.45 }}>{pub.address || 'Cork'} · {formatKm(km)} · {walkMinutes(km)}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
        <span style={{ borderRadius: 999, padding: '5px 8px', background: 'rgba(61,170,92,0.16)', color: COLORS.green, fontSize: 11, fontWeight: 850 }}>Open</span>
        <span style={{ borderRadius: 999, padding: '5px 8px', background: 'rgba(232,168,75,0.14)', color: COLORS.light, fontSize: 11, fontWeight: 850 }}>★ {asNumber(pub.avg_rating).toFixed(1)}</span>
        <span style={{ color: COLORS.muted, fontSize: 12 }}>{activityCount} activities</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={event => { event.stopPropagation(); onInvite() }} style={{ minHeight: 40, borderRadius: 12, border: '1px solid rgba(232,168,75,0.35)', background: 'rgba(201,125,46,0.18)', color: COLORS.light, fontWeight: 900, cursor: 'pointer' }}>Invite Friends</button>
        <button type="button" onClick={event => { event.stopPropagation(); onCreate() }} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: COLORS.accent, color: '#1A1008', fontWeight: 900, cursor: 'pointer' }}>Create Activity</button>
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
    <div style={{ background: COLORS.card, border: '1px solid rgba(245,237,214,0.1)', borderRadius: 18, padding: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(232,168,75,0.16)', display: 'grid', placeItems: 'center', fontSize: 22 }}>{type.emoji}</div>
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
        <button type="button" disabled={going || full} onClick={onJoin} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: going ? COLORS.green : full ? '#5f5140' : COLORS.accent, color: going || full ? '#fff' : '#1A1008', fontWeight: 900, cursor: going || full ? 'not-allowed' : 'pointer' }}>{going ? '✅ Going' : full ? 'Full' : 'Join Activity'}</button>
        <button type="button" onClick={onInvite} style={{ minHeight: 40, borderRadius: 12, border: '1px solid rgba(232,168,75,0.35)', background: 'rgba(201,125,46,0.16)', color: COLORS.light, fontWeight: 900, cursor: 'pointer' }}>Invite Friends</button>
      </div>
    </div>
  )
}

function InviteCard({ invite, onAccept, onDecline }: { invite: InviteRow; onAccept: () => void; onDecline: () => void }) {
  return (
    <div style={{ background: COLORS.card, border: '1px solid rgba(245,237,214,0.1)', borderRadius: 18, padding: 14 }}>
      <div style={{ color: COLORS.light, fontWeight: 900 }}>{profileName(invite.sender)} invited you</div>
      <div style={{ color: COLORS.muted, fontSize: 12, marginTop: 4 }}>Trust Score ₮{invite.senderTrust ?? 0}</div>
      <h3 style={{ margin: '10px 0 4px', fontSize: 16 }}>{invite.activity?.title ?? 'Pub plan'}</h3>
      <div style={{ color: COLORS.muted, fontSize: 13 }}>{invite.pub?.name ?? 'Pub'}{invite.activity?.scheduled_at ? ` · ${formatDateTime(invite.activity.scheduled_at)}` : ''}</div>
      {invite.message && <p style={{ color: COLORS.cream, fontSize: 13, lineHeight: 1.45, margin: '10px 0 0' }}>{invite.message}</p>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onAccept} style={{ minHeight: 40, borderRadius: 12, border: 'none', background: COLORS.green, color: '#fff', fontWeight: 900, cursor: 'pointer' }}>Accept</button>
        <button type="button" onClick={onDecline} style={{ minHeight: 40, borderRadius: 12, border: '1px solid rgba(245,237,214,0.16)', background: 'rgba(26,16,8,0.4)', color: COLORS.muted, fontWeight: 900, cursor: 'pointer' }}>Decline</button>
        <a href={`/messages?to=${invite.from_user_id}`} style={{ minHeight: 40, borderRadius: 12, border: '1px solid rgba(232,168,75,0.35)', color: COLORS.light, textDecoration: 'none', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 900 }}>Message</a>
      </div>
    </div>
  )
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 30, background: 'rgba(0,0,0,0.58)', display: 'grid', placeItems: 'center', padding: 18 }}>
      <section style={{ width: 'min(520px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: COLORS.panel, color: COLORS.cream, border: `1px solid rgba(201,125,46,0.38)`, borderRadius: 24, boxShadow: '0 30px 100px rgba(0,0,0,0.6)', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontFamily: 'Playfair Display, Georgia, serif', fontSize: 26 }}>{title}</h2>
          <button type="button" onClick={onClose} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(245,237,214,0.16)', background: 'rgba(26,16,8,0.55)', color: COLORS.cream, cursor: 'pointer', fontSize: 18 }}>×</button>
        </div>
        {children}
      </section>
    </div>
  )
}

const fieldStyle: CSSProperties = { width: '100%', minHeight: 46, borderRadius: 12, border: '1px solid rgba(245,237,214,0.16)', background: 'rgba(26,16,8,0.55)', color: COLORS.cream, padding: '10px 12px', fontSize: 16, boxSizing: 'border-box' }
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
          return <button key={friend.id} type="button" onClick={() => setSelected(prev => { const next = new Set(prev); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next })} style={{ border: `1px solid ${checked ? COLORS.light : 'rgba(245,237,214,0.16)'}`, background: checked ? 'rgba(201,125,46,0.22)' : 'rgba(26,16,8,0.5)', color: COLORS.cream, borderRadius: 999, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 7, minHeight: 42, cursor: 'pointer' }}><span>{friend.avatar_url ? '👤' : '🙂'}</span>{profileName(friend)} · ₮{friend.trust_score}</button>
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
      <button type="button" onClick={submit} disabled={busy || selected.size === 0} style={{ marginTop: 14, width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: selected.size ? COLORS.accent : '#5f5140', color: selected.size ? '#1A1008' : COLORS.muted, fontWeight: 950, cursor: selected.size ? 'pointer' : 'not-allowed' }}>{busy ? 'Sending…' : 'Send Invites'}</button>
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
      <button type="button" onClick={submit} disabled={busy} style={{ marginTop: 14, width: '100%', minHeight: 48, borderRadius: 14, border: 'none', background: COLORS.accent, color: '#1A1008', fontWeight: 950, cursor: 'pointer' }}>{busy ? 'Posting…' : 'Post Activity'}</button>
    </ModalShell>
  )
}
