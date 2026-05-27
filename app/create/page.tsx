'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'
import dynamic from 'next/dynamic'
import type { DeliveryZoneValue } from '@/components/DeliveryZoneMap'

const DeliveryZonePicker = dynamic(() => import('@/components/DeliveryZonePicker'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────

type PostType = 'text' | 'article' | 'photo' | 'video' | 'short' | 'link' | 'job' | 'event' | 'service' | 'product' | 'poll'
type Visibility = 'public' | 'connections' | 'community'

interface LinkPreview {
  title: string | null
  description: string | null
  image: string | null
  url: string
}

interface SpotifyTrack {
  id: string
  name: string
  artists: string
  album: string | null
  image: string | null
  url: string
  uri: string
  durationMs: number
  previewUrl: string | null
  previewSource?: 'spotify' | 'itunes' | null
}

type TextOverlayStyle = 'classic' | 'story' | 'neon' | 'caption' | 'minimal'
type TextOverlayPosition = 'top' | 'center' | 'bottom'

type TextOverlayOption = {
  id: TextOverlayStyle
  label: string
  description: string
  sampleStyle: React.CSSProperties
}

interface DirectStorageUploadResult {
  publicUrl: string
  storagePath: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POST_TYPES: { type: PostType; icon: string; label: string; desc: string }[] = [
  { type: 'text',     icon: '💬',  label: 'Text Post',    desc: 'Share a thought'         },
  { type: 'photo',    icon: '📷',  label: 'Photo',        desc: 'Share images'            },
  { type: 'video',    icon: '🎥',  label: 'Video',        desc: 'Upload a video'          },
  { type: 'short',    icon: '📱',  label: 'Short Video',  desc: 'TikTok-style clip'       },
  { type: 'article',  icon: '✍️',  label: 'Article',      desc: 'Long-form writing'      },
  { type: 'link',     icon: '🔗',  label: 'Shared Link',  desc: 'Share a URL'             },
  { type: 'job',      icon: '💼',  label: 'Job Posting',  desc: 'Post an opportunity'     },
  { type: 'event',    icon: '📅',  label: 'Event',        desc: 'Announce an event'       },
  { type: 'service',  icon: '🛠',  label: 'Service',      desc: 'Offer a service'         },
  { type: 'product',  icon: '📦',  label: 'Product',      desc: 'List a product'          },
  { type: 'poll',     icon: '📊',  label: 'Poll',         desc: 'Get opinions'            },
]

const PHOTO_UPLOAD_TIMEOUT_MS = 45_000
const VIDEO_UPLOAD_TIMEOUT_MS = 120_000

const TEXT_OVERLAY_OPTIONS: TextOverlayOption[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Bold white headline with soft shadow',
    sampleStyle: { color: '#ffffff', fontWeight: 900, textShadow: '0 3px 14px rgba(0,0,0,0.9)', letterSpacing: '-0.03em' },
  },
  {
    id: 'story',
    label: 'Story',
    description: 'Rounded social-story pill',
    sampleStyle: { color: '#0f172a', background: 'rgba(255,255,255,0.92)', fontWeight: 850, borderRadius: 999, padding: '0.26rem 0.68rem', boxShadow: '0 10px 28px rgba(0,0,0,0.28)' },
  },
  {
    id: 'neon',
    label: 'Neon',
    description: 'Electric emerald glow',
    sampleStyle: { color: '#bbf7d0', fontWeight: 900, textShadow: '0 0 8px rgba(34,197,94,0.95), 0 0 24px rgba(56,189,248,0.55)' },
  },
  {
    id: 'caption',
    label: 'Caption Bar',
    description: 'Readable dark subtitle strip',
    sampleStyle: { color: '#f8fafc', background: 'rgba(2,6,23,0.72)', fontWeight: 800, borderRadius: 12, padding: '0.38rem 0.7rem', backdropFilter: 'blur(8px)' },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Clean small uppercase label',
    sampleStyle: { color: '#f8fafc', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', textShadow: '0 2px 10px rgba(0,0,0,0.75)' },
  },
]

function normaliseTextOverlayStyle(value: string): TextOverlayStyle {
  return TEXT_OVERLAY_OPTIONS.some(option => option.id === value) ? value as TextOverlayStyle : 'classic'
}

function normaliseTextOverlayPosition(value: string): TextOverlayPosition {
  return value === 'top' || value === 'center' || value === 'bottom' ? value : 'bottom'
}

function getTextOverlayStyle(style: TextOverlayStyle): React.CSSProperties {
  const option = TEXT_OVERLAY_OPTIONS.find(item => item.id === style) ?? TEXT_OVERLAY_OPTIONS[0]
  return option.sampleStyle
}

function getTextOverlayPositionStyle(position: TextOverlayPosition): React.CSSProperties {
  if (position === 'top') return { alignItems: 'center', justifyContent: 'flex-start', paddingTop: '12%' }
  if (position === 'center') return { alignItems: 'center', justifyContent: 'center' }
  return { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '12%' }
}

function encodeStoragePath(path: string) {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

async function uploadToSupabaseStorageDirect(params: {
  bucket: string
  storagePath: string
  file: File
  contentType: string
  accessToken: string
  timeoutMs: number
}): Promise<DirectStorageUploadResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase upload config is missing')
  }

  const encodedPath = encodeStoragePath(params.storagePath)
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${params.bucket}/${encodedPath}`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), params.timeoutMs)

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${params.accessToken}`,
        'cache-control': '31536000',
        'content-type': params.contentType,
        'x-upsert': 'false',
      },
      body: params.file,
      signal: controller.signal,
    })

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`.trim()
      try {
        const data = await res.json() as { error?: string; message?: string }
        detail = data.error || data.message || detail
      } catch {
        try {
          const text = await res.text()
          if (text.trim()) detail = text.slice(0, 180)
        } catch { /* ignore */ }
      }
      throw new Error(detail)
    }

    return {
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${params.bucket}/${encodedPath}`,
      storagePath: params.storagePath,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const seconds = Math.round(params.timeoutMs / 1000)
      throw new Error(`Upload timed out after ${seconds}s. Please try again on Wi‑Fi or choose a smaller photo.`)
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}

const CATEGORIES = ['General', 'Business', 'Creative', 'Tech', 'Social', 'Education', 'Health', 'Finance', 'Events', 'Other']

const COUNTRY_OPTIONS: { code: string; name: string }[] = [
  { code: 'IE', name: 'Ireland' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'PL', name: 'Poland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'JP', name: 'Japan' },
  { code: 'SG', name: 'Singapore' },
  { code: 'IN', name: 'India' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ZA', name: 'South Africa' },
]

const s = {
  page: { minHeight: '100vh', padding: '2rem 1.5rem', maxWidth: '820px', margin: '0 auto' },
  heading: { fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.5rem' },
  subtext: { fontSize: '0.9rem', color: '#64748b', marginBottom: '2rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '2rem' },
  typeCard: (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(56,189,248,0.12)' : '#1e293b',
    border: `1.5px solid ${active ? '#38bdf8' : '#334155'}`,
    borderRadius: '12px',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'left',
  }),
  typeIcon: { fontSize: '1.5rem', marginBottom: '0.4rem' },
  typeLabel: (active: boolean): React.CSSProperties => ({
    fontSize: '0.88rem',
    fontWeight: 700,
    color: active ? '#38bdf8' : '#f1f5f9',
    display: 'block',
  }),
  typeDesc: { fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', display: 'block' },
  form: { background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.5rem' },
  formTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '1.25rem' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', marginBottom: '0.35rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  input: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  textarea: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const, resize: 'vertical' as const, minHeight: '120px', fontFamily: 'inherit' },
  select: { width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 0.9rem', fontSize: '0.95rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' as const },
  fieldGroup: { marginBottom: '1rem' },
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' },
  visRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const, marginBottom: '1rem' },
  visPill: (active: boolean): React.CSSProperties => ({
    padding: '0.4rem 0.9rem',
    borderRadius: '9999px',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? '#38bdf8' : '#0f172a',
    color: active ? '#0f172a' : '#94a3b8',
    border: `1px solid ${active ? '#38bdf8' : '#334155'}`,
  }),
  actions: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' as const },
  btnPrimary: { padding: '0.65rem 1.5rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', border: 'none', cursor: 'pointer' },
  btnSecondary: { padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#94a3b8', background: '#0f172a', border: '1px solid #334155', cursor: 'pointer' },
  btnDanger: { padding: '0.65rem 1.25rem', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, color: '#f87171', background: 'transparent', border: '1px solid #334155', cursor: 'pointer' },
  toast: (show: boolean): React.CSSProperties => ({
    position: 'fixed',
    bottom: '80px',
    right: '1.5rem',
    background: '#1e293b',
    border: '1px solid #38bdf8',
    borderRadius: '10px',
    padding: '0.75rem 1.25rem',
    fontSize: '0.88rem',
    color: '#38bdf8',
    fontWeight: 600,
    zIndex: 999,
    transition: 'opacity 0.3s',
    opacity: show ? 1 : 0,
    pointerEvents: 'none' as const,
  }),
  previewCard: { background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', padding: '1.25rem', marginTop: '1rem' },
  linkPreviewCard: { background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', overflow: 'hidden', marginTop: '0.75rem' },
  musicCard: { background: 'linear-gradient(135deg, rgba(30,215,96,0.14), rgba(15,23,42,0.98))', border: '1px solid rgba(30,215,96,0.32)', borderRadius: '12px', padding: '0.75rem', marginTop: '0.75rem' },
  pollOption: { display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' },
  draftBadge: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: '#64748b', marginLeft: '0.5rem' },
}

// ── Shared form fields ─────────────────────────────────────────────────────────

function SharedFields({
  location, setLocation,
  taggedUsers, setTaggedUsers,
  category, setCategory,
  visibility, setVisibility,
}: {
  location: string; setLocation: (v: string) => void
  taggedUsers: string; setTaggedUsers: (v: string) => void
  category: string; setCategory: (v: string) => void
  visibility: Visibility; setVisibility: (v: Visibility) => void
}) {
  return (
    <>
      <div style={s.row}>
        <div>
          <label style={s.label}>📍 Location</label>
          <input style={s.input} placeholder="Add location…" value={location} onChange={e => setLocation(e.target.value)} />
        </div>
        <div>
          <label style={s.label}>👥 Tag Members</label>
          <input style={s.input} placeholder="@name, @name…" value={taggedUsers} onChange={e => setTaggedUsers(e.target.value)} />
        </div>
      </div>
      <div style={s.row}>
        <div>
          <label style={s.label}>🏷 Category</label>
          <select style={s.select} value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label style={s.label}>👁 Visibility</label>
          <div style={s.visRow}>
            {(['public', 'connections', 'community'] as Visibility[]).map(v => (
              <button key={v} style={s.visPill(visibility === v)} onClick={() => setVisibility(v)}>
                {v === 'public' ? '🌍 Public' : v === 'connections' ? '🔗 Connections' : '👥 Community'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

// Orgs the current user can post on behalf of — populated on mount
// from organisation_members (filtered to owner/admin) + organisations
// (via the FK join). Used to render the "Post as" selector on
// text/article/photo types.
type ManageableOrg = {
  id: string
  name: string
  logo_url: string | null
  slug: string | null
}

export default function CreatePage() {
  const router = useRouter()
  const [selectedType, setSelectedType] = useState<PostType | null>(null)
  const [preview, setPreview] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState('')
  const [showToast, setShowToast] = useState(false)
  const draftTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // Shared fields
  const [location, setLocation] = useState('')
  const [taggedUsers, setTaggedUsers] = useState('')
  const [category, setCategory] = useState('General')
  const [visibility, setVisibility] = useState<Visibility>('public')

  // "Post as organisation" state.
  //   manageableOrgs — the list of orgs the user can post under,
  //     loaded once on mount. Empty array means "show no selector".
  //   selectedOrgId  — null for "post as @me" (default), or the id
  //     of one of the manageable orgs. Only sent in the publish
  //     payload for text/article/photo types; other types ignore it.
  const [manageableOrgs, setManageableOrgs] = useState<ManageableOrg[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)

  // Per-type form data
  const [formData, setFormData] = useState<Record<string, string>>({})

  // Poll-specific
  const [pollOptions, setPollOptions] = useState(['', ''])

  // Media upload state
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadedMediaUrl, setUploadedMediaUrl] = useState<string | null>(null)
  const [uploadedPhotoUrls, setUploadedPhotoUrls] = useState<string[]>([])
  const [uploadProgress, setUploadProgress] = useState<string>('')

  // Link preview
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [linkLoading, setLinkLoading] = useState(false)

  // Spotify music attachment for photo posts. Stores the selected
  // track as a normal Spotify URL in feed_posts.link_url so no schema
  // migration is required; PostCard renders it with the official embed.
  const [spotifyQuery, setSpotifyQuery] = useState('')
  const [spotifyResults, setSpotifyResults] = useState<SpotifyTrack[]>([])
  const [spotifyLoading, setSpotifyLoading] = useState(false)
  const [spotifyConfigured, setSpotifyConfigured] = useState(true)

  // Delivery zone (physical products only)
  const [deliveryScope, setDeliveryScope] = useState<'local' | 'national' | 'international' | 'worldwide' | ''>('')
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZoneValue | null>(null)
  const [deliveryCountries, setDeliveryCountries] = useState<string[]>([])
  const [deliveryNotes, setDeliveryNotes] = useState('')

  // Load the orgs the current user can post on behalf of, once on
  // mount. Queries organisation_members filtered to owner/admin and
  // joins the org row. Empty result is expected for most users —
  // the selector UI below only renders when manageableOrgs.length > 0.
  //
  // The 20260414000001 migration ensures that every org creator has
  // an 'owner' row in organisation_members (via trigger + backfill),
  // so creators automatically appear in this list without a separate
  // creator_id fallback query.
  useEffect(() => {
    let cancelled = false
    async function loadManageableOrgs() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return
      const { data, error } = await supabase
        .from('organisation_members')
        .select('role, organisation:organisations!organisation_id(id, name, logo_url, slug)')
        .eq('user_id', user.id)
        .in('role', ['owner', 'admin'])
      if (error) {
        console.warn('[create] manageable orgs fetch failed:', error.message)
        return
      }
      if (cancelled) return
      const orgs: ManageableOrg[] = []
      for (const row of (data ?? []) as Array<{ organisation: unknown }>) {
        // Supabase returns the nested relation as either a single
        // object or a one-element array depending on version — handle
        // both shapes.
        const raw = row.organisation
        const obj = Array.isArray(raw) ? raw[0] : raw
        if (obj && typeof obj === 'object' && 'id' in obj) {
          const o = obj as { id: string; name: string; logo_url: string | null; slug: string | null }
          orgs.push({ id: o.id, name: o.name, logo_url: o.logo_url, slug: o.slug })
        }
      }
      // De-dupe by id (in case the user has multiple roles in the
      // same org somehow) and sort alphabetically for a stable list.
      const seen = new Set<string>()
      const unique = orgs.filter(o => {
        if (seen.has(o.id)) return false
        seen.add(o.id)
        return true
      }).sort((a, b) => a.name.localeCompare(b.name))
      setManageableOrgs(unique)
    }
    loadManageableOrgs()
    return () => { cancelled = true }
  }, [])

  // Reset the "post as org" selection when the user switches to a
  // type that doesn't support it. Prevents a stale org id from
  // being submitted if the user picks Text → Product → Text again.
  useEffect(() => {
    const ORG_POSTABLE_TYPES: PostType[] = ['text', 'article', 'photo']
    if (selectedType && !ORG_POSTABLE_TYPES.includes(selectedType)) {
      setSelectedOrgId(null)
    }
  }, [selectedType])

  // Direct client-to-Supabase upload. Uses the Storage REST endpoint with an
  // AbortController timeout instead of storage-js `.upload()`, because mobile
  // PWA uploads could otherwise sit on "Uploading…" indefinitely when the
  // underlying request stalled.
  //
  // Requires the feed-media bucket RLS policy from
  // supabase/migrations/20260412_feed_media_bucket.sql which allows
  // authenticated users to INSERT into feed-media under their own user id
  // folder.
  //
  // Hardening parity with /api/upload/media (the server-side upload route):
  //   * MIME sniffing from extension when file.type is empty (older iOS
  //     reports empty type for HEIC + sometimes plain JPEG camera shots)
  //   * Synthetic filename built from the RESOLVED MIME (never from
  //     file.name) so uppercase/unicode/spaces can't leak into the path
  //   * user.id + random suffix aggressively sanitised so
  //     @supabase/storage-js can't throw a synchronous "The string did not
  //     match the expected pattern" DOMException on path validation
  //   * Upload request is abortable and returns a clear timeout error instead
  //     of leaving the form disabled forever
  //   * Public URL is derived from the known bucket/path, avoiding another
  //     storage-js URL-building call on the hot path
  //   * step breadcrumb surfaced in every error so the next mobile bug
  //     report tells us exactly which line failed
  const handleFileUpload = async (rawFile: File, _type: 'photo' | 'video' | 'short') => {
    // `_type` is kept for call-site compatibility; the kind is re-derived from
    // the actual MIME type below so we don't trust the UI's label.
    setUploadingMedia(true)
    setUploadProgress(_type === 'photo' ? 'Preparing photo…' : 'Preparing upload…')
    if (_type !== 'photo') setUploadedMediaUrl(null)

    // Client-side image compression — no-op for videos because
    // compressImage early-returns on non-image MIMEs. For camera
    // photos (8–15 MB) this shrinks to ~2 MB so direct uploads are
    // quick on mobile data before the browser sends anything over the network.
    let file: File
    try {
      file = await compressImage(rawFile, 2)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[create/upload] compression failed:', msg)
      setUploadProgress(`Upload failed [prepare] — ${msg}`)
      setUploadingMedia(false)
      return
    }

    // Step breadcrumb — updated before every operation so a sync throw
    // caught by the outer handler tells us WHICH line blew up rather than
    // just echoing an opaque DOMException message.
    let step = 'init'

    try {
      // ── 1. Resolve MIME type (sniff from extension if empty) ────────────
      step = 'resolve-mime'
      const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
      const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v', 'video/3gpp']
      const EXT_TO_MIME: Record<string, string> = {
        jpg:  'image/jpeg',
        jpeg: 'image/jpeg',
        png:  'image/png',
        gif:  'image/gif',
        webp: 'image/webp',
        heic: 'image/heic',
        heif: 'image/heif',
        mp4:  'video/mp4',
        mov:  'video/quicktime',
        webm: 'video/webm',
        m4v:  'video/x-m4v',
        '3gp':'video/3gpp',
      }
      let fileType = file.type
      if (!fileType) {
        const ext = (file.name.split('.').pop() ?? '').toLowerCase()
        if (ext in EXT_TO_MIME) {
          fileType = EXT_TO_MIME[ext]
          console.log('[create/upload] synthesised MIME from extension:', ext, '→', fileType)
        } else {
          setUploadProgress(`Upload failed — file has no MIME type and unrecognised extension: .${ext || '(none)'}`)
          setUploadingMedia(false)
          return
        }
      }

      const isImage = IMAGE_TYPES.includes(fileType)
      const isVideo = VIDEO_TYPES.includes(fileType)
      if (!isImage && !isVideo) {
        setUploadProgress(`Upload failed — unsupported file type: ${fileType}`)
        setUploadingMedia(false)
        return
      }

      // ── 2. Size limit ───────────────────────────────────────────────────
      step = 'size-check'
      const MAX_IMAGE = 10 * 1024 * 1024   //  10 MB
      const MAX_VIDEO = 100 * 1024 * 1024  // 100 MB
      const sizeLimit = isVideo ? MAX_VIDEO : MAX_IMAGE
      if (file.size > sizeLimit) {
        const mb = Math.round(sizeLimit / 1024 / 1024)
        setUploadProgress(`Upload failed — file too large (max ${mb} MB)`)
        setUploadingMedia(false)
        return
      }

      // ── 3. Auth (needed for RLS — the bucket policy allows inserts only
      //        under folders named after the user's own id) ───────────────
      step = 'auth'
      const supabase = createClient()
      const [{ data: { user } }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ])
      if (!user) {
        setUploadProgress('Upload failed — please sign in and try again')
        setUploadingMedia(false)
        return
      }
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setUploadProgress('Upload failed — your session was not ready. Please refresh and try again.')
        setUploadingMedia(false)
        return
      }

      // ── 4. Build a 100% synthetic storage path ──────────────────────────
      // Folder layout: <kind>/<user_id>/<timestamp>-<random>.<ext>
      // The second segment MUST be the user id to satisfy the RLS policy.
      // The extension is derived from the validated MIME (never from
      // file.name) so we only ever produce ASCII, lowercase, no-space,
      // no-punctuation names that Supabase Storage always accepts.
      step = 'build-path'
      const MIME_TO_EXT: Record<string, string> = {
        'image/jpeg':      'jpg',
        'image/png':       'png',
        'image/gif':       'gif',
        'image/webp':      'webp',
        'image/heic':      'heic',
        'image/heif':      'heif',
        'video/mp4':       'mp4',
        'video/webm':      'webm',
        'video/quicktime': 'mov',
        'video/x-m4v':     'm4v',
        'video/3gpp':      '3gp',
      }
      const ext = MIME_TO_EXT[fileType] || (isVideo ? 'mp4' : 'jpg')
      const kind: 'photo' | 'video' = isVideo ? 'video' : 'photo'

      // Sanitise user.id defensively (Supabase UUIDs are already lowercase
      // [0-9a-f-], but belt-and-braces in case something upstream mangles
      // the session user object).
      const uidSafe = (user.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'anon'

      // Sanitise the random suffix and fall back to a timestamp tail if the
      // result collapses to empty (edge case of Math.random().toString(36)).
      const rand = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, '')
      const randSafe = rand || Date.now().toString(36)

      const storagePath = `${kind}/${uidSafe}/${Date.now()}-${randSafe}.${ext}`
      console.log('[create/upload] storagePath:', storagePath, 'contentType:', fileType, 'originalName:', file.name)

      setUploadProgress(`Uploading ${(file.size / 1024 / 1024).toFixed(1)} MB…`)

      // ── 5. Upload ───────────────────────────────────────────────────────
      // Use an abortable fetch to the Supabase Storage REST API. This keeps
      // uploads direct from the phone to Supabase, but guarantees the UI will
      // recover with a clear timeout message if the mobile network/PWA stalls.
      step = 'upload'
      let publicUrl: string
      try {
        const uploaded = await uploadToSupabaseStorageDirect({
          bucket: 'feed-media',
          storagePath,
          file,
          contentType: fileType,
          accessToken,
          timeoutMs: isVideo ? VIDEO_UPLOAD_TIMEOUT_MS : PHOTO_UPLOAD_TIMEOUT_MS,
        })
        publicUrl = uploaded.publicUrl
      } catch (thrown) {
        const msg = thrown instanceof Error ? thrown.message : String(thrown)
        console.error('[create/upload] direct storage upload failed:', {
          step,
          message: msg,
          storagePath,
          contentType: fileType,
          fileNameOriginal: file.name,
          fileTypeRaw: file.type,
          fileSize: file.size,
          userId: user.id,
        })
        if (msg.toLowerCase().includes('bucket not found')) {
          setUploadProgress('Upload failed — the feed-media bucket does not exist. Run the migration in Supabase SQL editor.')
        } else if (msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('policy')) {
          setUploadProgress('Upload failed — storage policy blocked the upload. Run the feed-media RLS migration.')
        } else if (msg.toLowerCase().includes('expected pattern')) {
          setUploadProgress(`Upload failed — storage validator rejected the path. Report this: ${storagePath}`)
        } else if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists')) {
          setUploadProgress('Upload failed — a file with this name already exists. Please try again.')
        } else {
          setUploadProgress(`Upload failed — ${msg}`)
        }
        setUploadingMedia(false)
        return
      }

      if (_type === 'photo') {
        setUploadedPhotoUrls(prev => {
          const next = [...prev, publicUrl]
          setUploadedMediaUrl(next[0] ?? publicUrl)
          setUploadProgress(`✓ ${next.length} photo${next.length === 1 ? '' : 's'} ready`)
          return next
        })
      } else {
        setUploadedMediaUrl(publicUrl)
        setUploadProgress('✓ Upload complete')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[create/upload] unhandled at step', step, ':', err)
      setUploadProgress(`Upload failed [${step}] — ${msg}`)
    } finally {
      setUploadingMedia(false)
    }
  }

  const showToastMsg = (msg: string) => {
    setToast(msg)
    setShowToast(true)
    setTimeout(() => setShowToast(false), 3000)
  }

  const getDraftKey = (type: PostType) => `ft_draft_${type}`

  // Load draft when type changes
  useEffect(() => {
    if (!selectedType) return
    try {
      const raw = localStorage.getItem(getDraftKey(selectedType))
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, string>
        setFormData(saved.formData ? JSON.parse(saved.formData) : {})
        setLocation(saved.location ?? '')
        setTaggedUsers(saved.taggedUsers ?? '')
        setCategory(saved.category ?? 'General')
        setVisibility((saved.visibility as Visibility) ?? 'public')
        if (saved.pollOptions) setPollOptions(JSON.parse(saved.pollOptions))
        showToastMsg('📝 Draft restored')
      } else {
        setFormData({})
        setLocation('')
        setTaggedUsers('')
        setCategory('General')
        setVisibility('public')
        setPollOptions(['', ''])
      }
    } catch { /* ignore */ }
    setUploadedMediaUrl(null)
    setUploadedPhotoUrls([])
    setUploadProgress('')
  }, [selectedType])

  // Auto-save draft every 10s
  useEffect(() => {
    if (!selectedType) return
    if (draftTimer.current) clearInterval(draftTimer.current)
    draftTimer.current = setInterval(() => {
      try {
        localStorage.setItem(getDraftKey(selectedType), JSON.stringify({
          formData: JSON.stringify(formData),
          location,
          taggedUsers,
          category,
          visibility,
          pollOptions: JSON.stringify(pollOptions),
          savedAt: new Date().toISOString(),
        }))
      } catch { /* ignore */ }
    }, 10000)
    return () => { if (draftTimer.current) clearInterval(draftTimer.current) }
  }, [selectedType, formData, location, taggedUsers, category, visibility, pollOptions])

  const setField = (key: string, value: string) => setFormData(prev => ({ ...prev, [key]: value }))
  const f = (key: string) => formData[key] ?? ''

  const selectedSpotifyTrack: SpotifyTrack | null = (() => {
    if (!f('spotify_track_id')) return null
    return {
      id: f('spotify_track_id'),
      name: f('spotify_track_name'),
      artists: f('spotify_track_artists'),
      album: f('spotify_track_album') || null,
      image: f('spotify_track_image') || null,
      url: f('spotify_url'),
      uri: f('spotify_uri'),
      durationMs: Number(f('spotify_duration_ms') || 0),
      previewUrl: f('spotify_preview_url') || null,
      previewSource: (f('spotify_preview_source') as SpotifyTrack['previewSource']) || null,
    }
  })()

  const textOverlayText = f('text_overlay_text').trim()
  const textOverlayStyle = normaliseTextOverlayStyle(f('text_overlay_style'))
  const textOverlayPosition = normaliseTextOverlayPosition(f('text_overlay_position'))

  const renderTextOverlay = (compact = false) => {
    if (!textOverlayText) return null
    const overlayStyle = getTextOverlayStyle(textOverlayStyle)
    return (
      <div
        aria-label={`Text overlay: ${textOverlayText}`}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          pointerEvents: 'none',
          display: 'flex',
          textAlign: 'center',
          paddingLeft: compact ? '8%' : '10%',
          paddingRight: compact ? '8%' : '10%',
          ...getTextOverlayPositionStyle(textOverlayPosition),
        }}
      >
        <div style={{
          maxWidth: '100%',
          fontSize: compact ? 'clamp(1rem, 6vw, 1.65rem)' : 'clamp(1.25rem, 7vw, 2.25rem)',
          lineHeight: 1.05,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          ...overlayStyle,
        }}>
          {textOverlayText}
        </div>
      </div>
    )
  }

  const renderTextOverlayEditor = (helperText: string) => (
    <div style={s.fieldGroup}>
      <label style={s.label}>Text over media</label>
      <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 0, marginBottom: '0.6rem', lineHeight: 1.45 }}>
        {helperText}
      </p>
      <textarea
        style={{ ...s.textarea, minHeight: '76px' }}
        placeholder="Add text to place over the photo or video…"
        maxLength={90}
        value={f('text_overlay_text')}
        onChange={e => setField('text_overlay_text', e.target.value)}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginTop: '0.35rem', color: '#64748b', fontSize: '0.74rem' }}>
        <span>Optional — leave blank for no overlay</span>
        <span>{f('text_overlay_text').length}/90</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(116px, 1fr))', gap: '0.55rem', marginTop: '0.75rem' }}>
        {TEXT_OVERLAY_OPTIONS.map(option => {
          const active = textOverlayStyle === option.id
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setField('text_overlay_style', option.id)}
              style={{
                border: active ? '1.5px solid #38bdf8' : '1px solid #334155',
                background: active ? 'rgba(56,189,248,0.12)' : '#0f172a',
                borderRadius: 12,
                padding: '0.65rem',
                cursor: 'pointer',
                textAlign: 'left',
                color: '#f8fafc',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ display: 'inline-flex', fontSize: '0.9rem', lineHeight: 1, marginBottom: 7, ...option.sampleStyle }}>Aa</span>
              <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: active ? '#38bdf8' : '#e2e8f0' }}>{option.label}</span>
              <span style={{ display: 'block', marginTop: 2, color: '#64748b', fontSize: '0.68rem', lineHeight: 1.25 }}>{option.description}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginTop: '0.75rem' }}>
        {(['top', 'center', 'bottom'] as TextOverlayPosition[]).map(position => {
          const active = textOverlayPosition === position
          return (
            <button
              key={position}
              type="button"
              onClick={() => setField('text_overlay_position', position)}
              style={{ ...s.visPill(active), textTransform: 'capitalize' }}
            >
              {position === 'top' ? '⬆️ Top' : position === 'center' ? '⏺ Center' : '⬇️ Bottom'}
            </button>
          )
        })}
      </div>
      {textOverlayText && (
        <div style={{ position: 'relative', marginTop: '0.75rem', borderRadius: 14, overflow: 'hidden', minHeight: 150, border: '1px solid #334155', background: 'linear-gradient(135deg, #0f172a, #0f766e 55%, #020617)' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 72% 26%, rgba(255,255,255,0.22), transparent 23%), linear-gradient(180deg, transparent, rgba(0,0,0,0.28))' }} />
          {renderTextOverlay(true)}
        </div>
      )}
    </div>
  )

  const discardDraft = () => {
    if (selectedType) localStorage.removeItem(getDraftKey(selectedType))
    setSelectedType(null)
    setFormData({})
    setPreview(false)
  }

  const handleLinkBlur = async (url: string) => {
    if (!url.startsWith('http')) return
    setLinkLoading(true)
    try {
      const res = await fetch(`/api/create/link-preview?url=${encodeURIComponent(url)}`)
      const data = await res.json() as LinkPreview
      setLinkPreview(data)
      if (data.title) setField('link_title', data.title)
      if (data.description) setField('description', data.description)
    } catch { /* ignore */ }
    setLinkLoading(false)
  }

  const searchSpotify = async (query: string) => {
    const q = query.trim()
    setSpotifyQuery(query)
    if (q.length < 2) {
      setSpotifyResults([])
      return
    }
    setSpotifyLoading(true)
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as { tracks?: SpotifyTrack[]; configured?: boolean }
      setSpotifyConfigured(data.configured !== false)
      setSpotifyResults(data.tracks ?? [])
    } catch {
      setSpotifyResults([])
    } finally {
      setSpotifyLoading(false)
    }
  }

  const selectSpotifyTrack = (track: SpotifyTrack) => {
    setField('spotify_track_id', track.id)
    setField('spotify_track_name', track.name)
    setField('spotify_track_artists', track.artists)
    setField('spotify_track_album', track.album ?? '')
    setField('spotify_track_image', track.image ?? '')
    setField('spotify_url', track.url)
    setField('spotify_uri', track.uri)
    setField('spotify_duration_ms', String(track.durationMs))
    setField('spotify_preview_url', track.previewUrl ?? '')
    setField('spotify_preview_source', track.previewSource ?? '')
    setSpotifyResults([])
    setSpotifyQuery('')
  }

  const clearSpotifyTrack = () => {
    ;['spotify_track_id', 'spotify_track_name', 'spotify_track_artists', 'spotify_track_album', 'spotify_track_image', 'spotify_url', 'spotify_uri', 'spotify_duration_ms', 'spotify_preview_url', 'spotify_preview_source']
      .forEach(key => setField(key, ''))
  }

  const handlePhotoFiles = async (files: FileList | null) => {
    const selected = Array.from(files ?? [])
    if (selected.length === 0) return
    const availableSlots = Math.max(0, 10 - uploadedPhotoUrls.length)
    const toUpload = selected.slice(0, availableSlots)
    if (toUpload.length === 0) {
      showToastMsg('❌ You can add up to 10 photos per post')
      return
    }
    if (selected.length > availableSlots) {
      showToastMsg(`Only adding ${availableSlots} more photo${availableSlots === 1 ? '' : 's'} — max 10 per post`)
    }
    setField('file_names', [...uploadedPhotoUrls.map((_, i) => `Photo ${i + 1}`), ...toUpload.map(file => file.name)].join(', '))
    for (let i = 0; i < toUpload.length; i += 1) {
      setUploadProgress(`Uploading photo ${i + 1} of ${toUpload.length}…`)
      await handleFileUpload(toUpload[i], 'photo')
    }
  }

  const removeUploadedPhoto = (index: number) => {
    setUploadedPhotoUrls(prev => {
      const next = prev.filter((_, i) => i !== index)
      setUploadedMediaUrl(next[0] ?? null)
      setUploadProgress(next.length > 0 ? `✓ ${next.length} photo${next.length === 1 ? '' : 's'} ready` : '')
      return next
    })
  }

  const buildPublishPayload = () => {
    if (!selectedType) return null
    let data: Record<string, unknown> = { ...formData }
    if (selectedType === 'poll') {
      data = { ...data, options: pollOptions.filter(o => o.trim()), question: f('question') }
    }
    if (selectedType === 'photo' && (uploadedPhotoUrls.length > 0 || uploadedMediaUrl)) {
      const photoUrls = uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : (uploadedMediaUrl ? [uploadedMediaUrl] : [])
      data = { ...data, media_url: photoUrls[0] ?? uploadedMediaUrl, media_urls: photoUrls }
    } else if (['video', 'short'].includes(selectedType) && uploadedMediaUrl) {
      data = { ...data, media_url: uploadedMediaUrl }
    }
    // Inject delivery zone fields for physical products
    if (selectedType === 'product' && (f('product_type') || 'physical') === 'physical') {
      data = {
        ...data,
        delivery_scope: deliveryScope || null,
        delivery_origin_lat: deliveryZone?.lat ?? null,
        delivery_origin_lng: deliveryZone?.lng ?? null,
        delivery_radius_km: deliveryZone?.radiusKm ?? null,
        delivery_countries: deliveryCountries.length > 0 ? deliveryCountries : null,
        delivery_notes: deliveryNotes.trim() || null,
      }
    }
    // Only include organisation_id for types where it's honoured
    // server-side (text / article / photo). The publish route strips
    // it for other types anyway, but sending it explicitly keeps the
    // client + server in lockstep and avoids a confusing "why didn't
    // my product post use the org byline?" question later.
    const payload: Record<string, unknown> = {
      type: selectedType,
      data,
      visibility,
      location,
      taggedUsers,
      category,
    }
    const ORG_POSTABLE = new Set<PostType>(['text', 'article', 'photo'])
    if (selectedOrgId && ORG_POSTABLE.has(selectedType)) {
      payload.organisation_id = selectedOrgId
    }
    return payload
  }

  const validatePayload = (): string | null => {
    if (!selectedType) return 'Pick a content type first'
    const content = f('content').trim()
    const title   = f('title').trim()

    switch (selectedType) {
      case 'text':
        if (!content) return 'Text post needs some content'
        break
      case 'article':
        if (!title) return 'Article needs a title'
        if (!f('body').trim()) return 'Article needs body content'
        break
      case 'photo':
        if (uploadedPhotoUrls.length === 0 && !uploadedMediaUrl) return 'Upload at least one photo before publishing'
        break
      case 'video':
      case 'short':
        if (!uploadedMediaUrl) return 'Upload a file before publishing'
        break
      case 'link':
        if (!f('url').trim()) return 'Enter a URL'
        break
      case 'job':
      case 'event':
      case 'service':
        if (!title) return 'Title is required'
        if (!f('description').trim()) return 'Description is required'
        if (selectedType === 'event' && !f('start_date')) return 'Start date is required'
        break
      case 'product':
        if (!title) return 'Title is required'
        if (!f('description').trim()) return 'Description is required'
        // Delivery zone validation for physical products
        if ((f('product_type') || 'physical') === 'physical') {
          if (!deliveryScope) return 'Please select a delivery scope'
          if (deliveryScope === 'local' && !deliveryZone) return 'Please click the map to set your delivery origin'
          if (deliveryScope === 'national' && deliveryCountries.length === 0) return 'Please select a country'
        }
        break
      case 'poll':
        if (!f('question').trim()) return 'Poll needs a question'
        if (pollOptions.filter(o => o.trim()).length < 2) return 'Poll needs at least 2 options'
        break
    }
    return null
  }

  const handlePublish = async () => {
    const validationError = validatePayload()
    if (validationError) {
      showToastMsg(`❌ ${validationError}`)
      return
    }
    const payload = buildPublishPayload()
    if (!payload) return
    setPublishing(true)
    try {
      const res = await fetch('/api/create/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await res.json() as { success?: boolean; redirectUrl?: string; error?: string }
      if (result.success) {
        if (selectedType) localStorage.removeItem(getDraftKey(selectedType))
        showToastMsg('✅ Published!')
        setTimeout(() => router.push(result.redirectUrl ?? '/feed'), 800)
      } else {
        // Surface the actual server error message so users know what went wrong
        showToastMsg(`❌ ${result.error ?? 'Failed to publish'}`)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error'
      showToastMsg(`❌ ${message}`)
    }
    setPublishing(false)
  }

  // ── Render form for each type ─────────────────────────────────────────────

  const renderForm = () => {
    if (!selectedType) return null

    const typeLabel = POST_TYPES.find(t => t.type === selectedType)?.label ?? selectedType
    const typeIcon  = POST_TYPES.find(t => t.type === selectedType)?.icon ?? ''

    return (
      <div style={s.form}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={s.formTitle}>{typeIcon} {typeLabel}</h2>
          <button onClick={() => setPreview(v => !v)} style={s.btnSecondary}>
            {preview ? '✏️ Edit' : '👁 Preview'}
          </button>
        </div>

        {preview ? renderPreview() : (
          <>
            {/* "Post as" selector — shown only when:
                  1. The user manages at least one organisation, AND
                  2. The selected type is text / article / photo
                Other types (product/service/job/event/video/etc.)
                have their own author context so we hide the chip. */}
            {manageableOrgs.length > 0 && selectedType && ['text', 'article', 'photo'].includes(selectedType) && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '0.5rem' }}>
                  Post as
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrgId(null)}
                    style={{
                      padding: '0.55rem 1rem',
                      borderRadius: 999,
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      border: selectedOrgId === null ? '1.5px solid rgba(56,189,248,0.45)' : '1px solid rgba(148,163,184,0.22)',
                      background: selectedOrgId === null ? 'rgba(56,189,248,0.12)' : 'transparent',
                      color: selectedOrgId === null ? '#38bdf8' : '#94a3b8',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>👤</span>
                    <span>@me</span>
                  </button>
                  {manageableOrgs.map(org => {
                    const active = selectedOrgId === org.id
                    return (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => setSelectedOrgId(org.id)}
                        title={`Post as ${org.name}`}
                        style={{
                          padding: '0.55rem 1rem',
                          borderRadius: 999,
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          border: active ? '1.5px solid rgba(139,92,246,0.5)' : '1px solid rgba(148,163,184,0.22)',
                          background: active ? 'rgba(139,92,246,0.14)' : 'transparent',
                          color: active ? '#c4b5fd' : '#94a3b8',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                          maxWidth: 220,
                          overflow: 'hidden',
                        }}
                      >
                        {org.logo_url ? (
                          <img
                            src={org.logo_url}
                            alt=""
                            style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <span style={{ fontSize: '0.95rem' }}>🏢</span>
                        )}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{org.name}</span>
                      </button>
                    )
                  })}
                </div>
                {selectedOrgId && (
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '0.45rem' }}>
                    This post will appear in the feed under the organisation&rsquo;s name and logo. You&rsquo;ll still be recorded as the author for accountability.
                  </div>
                )}
              </div>
            )}
            {renderTypeFields()}
            <SharedFields
              location={location} setLocation={setLocation}
              taggedUsers={taggedUsers} setTaggedUsers={setTaggedUsers}
              category={category} setCategory={setCategory}
              visibility={visibility} setVisibility={setVisibility}
            />
            <div style={s.actions}>
              <button style={{ ...s.btnPrimary, opacity: (publishing || uploadingMedia) ? 0.6 : 1 }} onClick={handlePublish} disabled={publishing || uploadingMedia}>
                {publishing ? 'Publishing…' : uploadingMedia ? 'Uploading…' : '🚀 Publish'}
              </button>
              <button style={s.btnSecondary} onClick={() => setPreview(true)}>👁 Preview</button>
              <button style={s.btnDanger} onClick={discardDraft}>🗑 Discard</button>
            </div>
          </>
        )}
      </div>
    )
  }

  const renderTypeFields = () => {
    switch (selectedType) {
      case 'text':
        return (
          <div style={s.fieldGroup}>
            <label style={s.label}>What&apos;s on your mind?</label>
            <textarea
              style={{ ...s.textarea, minHeight: '160px' }}
              placeholder="Share an update with your community…"
              value={f('content')}
              onChange={e => setField('content', e.target.value)}
              maxLength={5000}
            />
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', textAlign: 'right' }}>
              {(f('content') ?? '').length}/5000
            </div>
          </div>
        )

      case 'article':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Title</label>
              <input style={s.input} placeholder="Article title…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Body</label>
              <textarea style={{ ...s.textarea, minHeight: '240px' }} placeholder="Write your article here…" value={f('body')} onChange={e => setField('body', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Cover Image URL (optional)</label>
              <input style={s.input} placeholder="https://…" value={f('cover_image_url')} onChange={e => setField('cover_image_url', e.target.value)} />
            </div>
          </>
        )

      case 'photo':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Photos</label>
              <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 0, marginBottom: '0.6rem', lineHeight: 1.45 }}>
                Add up to 10 photos. People can swipe or tap through them in the feed.
              </p>
              {/* Explicit MIME list INCLUDING HEIC/HEIF — iOS Safari's
                  `image/*` wildcard filters HEIC out of the picker on some
                  builds, so iPhone users would tap their camera roll and
                  see nothing happen. Listing the types explicitly is the
                  only reliable fix. image/* stays at the end as a catch-all
                  for anything else the browser might surface. */}
              <input type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,image/*" style={{ ...s.input, padding: '0.5rem' }} onChange={e => {
                void handlePhotoFiles(e.target.files)
                e.currentTarget.value = ''
              }} />
              {uploadProgress && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: uploadProgress.startsWith('✓') ? '#34d399' : uploadProgress.startsWith('Upload') ? '#f87171' : '#64748b' }}>
                  {uploadingMedia ? '⏳ ' : ''}{uploadProgress}
                </div>
              )}
              {uploadedPhotoUrls.length > 0 && selectedType === 'photo' && (
                <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: '0.6rem' }}>
                  {uploadedPhotoUrls.map((url, i) => (
                    <div key={`${url}-${i}`} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', border: '1px solid #334155', background: '#0f172a', aspectRatio: '1 / 1' }}>
                      <img src={url} alt={`Preview ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(15,23,42,0.8)', color: '#f8fafc', borderRadius: 999, padding: '2px 7px', fontSize: '0.72rem', fontWeight: 800 }}>{i + 1}</span>
                      <button type="button" onClick={() => removeUploadedPhoto(i)} style={{ position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(248,113,113,0.5)', background: 'rgba(15,23,42,0.86)', color: '#fecaca', cursor: 'pointer', fontWeight: 800 }} aria-label={`Remove photo ${i + 1}`}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Caption</label>
              <textarea style={s.textarea} placeholder="Write a caption…" value={f('caption')} onChange={e => setField('caption', e.target.value)} />
            </div>
            {renderTextOverlayEditor('Pick a popular text style and position. The overlay appears on top of the photo carousel in the feed.')}
            <div style={s.fieldGroup}>
              <label style={s.label}>🎵 Add music from Spotify</label>
              <p style={{ color: '#64748b', fontSize: '0.82rem', marginTop: 0, marginBottom: '0.6rem', lineHeight: 1.45 }}>
                Choose a track to sit with this photo. The speaker plays a real preview when one is available; otherwise the song still displays without fake audio.
              </p>
              <input
                style={s.input}
                placeholder="Search Spotify tracks…"
                value={spotifyQuery}
                onChange={e => searchSpotify(e.target.value)}
              />
              {!spotifyConfigured && (
                <div style={{ marginTop: '0.5rem', color: '#fbbf24', fontSize: '0.8rem', lineHeight: 1.45 }}>
                  Spotify search needs API credentials. Paste a Spotify track URL below for now.
                </div>
              )}
              {spotifyLoading && <div style={{ marginTop: '0.5rem', color: '#64748b', fontSize: '0.8rem' }}>Searching Spotify…</div>}
              {spotifyResults.length > 0 && (
                <div style={{ marginTop: '0.5rem', border: '1px solid #334155', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
                  {spotifyResults.map(track => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => selectSpotifyTrack(track)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #1e293b', padding: '0.65rem 0.75rem', cursor: 'pointer', color: '#f1f5f9', textAlign: 'left', fontFamily: 'inherit' }}
                    >
                      {track.image ? <img src={track.image} alt="" style={{ width: 42, height: 42, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 42, height: 42, borderRadius: 6, background: '#1e293b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🎵</span>}
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.name}</strong>
                        <span style={{ color: '#94a3b8', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{track.artists}</span>
                      </span>
                      <span style={{ flexShrink: 0, borderRadius: 999, padding: '3px 7px', fontSize: '0.68rem', fontWeight: 800, color: track.previewUrl ? '#bbf7d0' : '#fbbf24', background: track.previewUrl ? 'rgba(22,163,74,0.18)' : 'rgba(251,191,36,0.12)', border: `1px solid ${track.previewUrl ? 'rgba(34,197,94,0.28)' : 'rgba(251,191,36,0.25)'}` }}>
                        {track.previewUrl ? (track.previewSource === 'itunes' ? 'Apple preview' : 'Preview') : 'No preview'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {selectedSpotifyTrack && (
                <div style={s.musicCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {selectedSpotifyTrack.image ? <img src={selectedSpotifyTrack.image} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover' }} /> : <span style={{ width: 56, height: 56, borderRadius: 8, background: '#0f172a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🎵</span>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#bbf7d0', fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Selected track</div>
                      <div style={{ color: '#f1f5f9', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSpotifyTrack.name}</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSpotifyTrack.artists}</div>
                      <div style={{ color: selectedSpotifyTrack.previewUrl ? '#86efac' : '#fbbf24', fontSize: '0.76rem', marginTop: 2 }}>
                        {selectedSpotifyTrack.previewUrl ? (selectedSpotifyTrack.previewSource === 'itunes' ? 'Speaker will play Apple/iTunes preview' : 'Speaker will play Spotify preview') : 'Preview unavailable — song title will show only'}
                      </div>
                    </div>
                    <button type="button" onClick={clearSpotifyTrack} style={{ ...s.btnSecondary, padding: '0.45rem 0.7rem' }}>Remove</button>
                  </div>
                </div>
              )}
              <input
                style={{ ...s.input, marginTop: '0.75rem' }}
                placeholder="Or paste Spotify track URL…"
                value={f('spotify_url')}
                onChange={e => setField('spotify_url', e.target.value)}
              />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Alt Text</label>
              <input style={s.input} placeholder="Describe the image for accessibility…" value={f('alt_text')} onChange={e => setField('alt_text', e.target.value)} />
            </div>
          </>
        )

      case 'video':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Video File</label>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/3gpp,video/*" style={{ ...s.input, padding: '0.5rem' }} onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  setField('file_name', file.name)
                  handleFileUpload(file, 'video')
                }
              }} />
              {uploadProgress && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: uploadProgress.startsWith('✓') ? '#34d399' : uploadProgress.startsWith('Upload') ? '#f87171' : '#64748b' }}>
                  {uploadingMedia ? '⏳ ' : ''}{uploadProgress}
                </div>
              )}
              {uploadedMediaUrl && selectedType === 'video' && (
                <div style={{ position: 'relative', marginTop: '0.75rem', maxWidth: '100%', borderRadius: '8px', overflow: 'hidden', background: '#020617' }}>
                  <video src={uploadedMediaUrl} controls style={{ width: '100%', maxHeight: '300px', display: 'block' }} />
                  {renderTextOverlay(true)}
                </div>
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Title</label>
              <input style={s.input} placeholder="Video title…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="What's this video about?" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            {renderTextOverlayEditor('Add a headline-style overlay that sits over the video in the feed.')}
          </>
        )

      case 'short':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Short Video (vertical)</label>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,video/x-m4v,video/3gpp,video/*" style={{ ...s.input, padding: '0.5rem' }} onChange={e => {
                const file = e.target.files?.[0]
                if (file) {
                  setField('file_name', file.name)
                  handleFileUpload(file, 'short')
                }
              }} />
              {uploadProgress && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.82rem', color: uploadProgress.startsWith('✓') ? '#34d399' : uploadProgress.startsWith('Upload') ? '#f87171' : '#64748b' }}>
                  {uploadingMedia ? '⏳ ' : ''}{uploadProgress}
                </div>
              )}
              {uploadedMediaUrl && selectedType === 'short' && (
                <div style={{ position: 'relative', marginTop: '0.75rem', maxWidth: 260, borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
                  <video src={uploadedMediaUrl} controls style={{ width: '100%', maxHeight: '400px', aspectRatio: '9/16', display: 'block', background: '#000' }} />
                  {renderTextOverlay(true)}
                </div>
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Caption <span style={{ fontWeight: 400, color: '#64748b' }}>({(f('caption') ?? '').length}/100)</span></label>
              <input style={s.input} placeholder="Add a caption…" maxLength={100} value={f('caption')} onChange={e => setField('caption', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Audio Description</label>
              <input style={s.input} placeholder="Describe the audio for accessibility…" value={f('audio_desc')} onChange={e => setField('audio_desc', e.target.value)} />
            </div>
            {renderTextOverlayEditor('Add a short, social-story style overlay for this vertical video.')}
          </>
        )

      case 'link':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>URL</label>
              <input
                style={s.input}
                placeholder="https://…"
                value={f('url')}
                onChange={e => { setField('url', e.target.value); setLinkPreview(null) }}
                onBlur={e => handleLinkBlur(e.target.value)}
              />
              {linkLoading && <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '0.4rem' }}>Loading preview…</p>}
            </div>
            {linkPreview && (
              <div style={s.linkPreviewCard}>
                {linkPreview.image && <img src={linkPreview.image} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover' }} />}
                <div style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>{linkPreview.title ?? f('url')}</div>
                  {linkPreview.description && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.25rem' }}>{linkPreview.description}</div>}
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '0.4rem' }}>{linkPreview.url}</div>
                </div>
              </div>
            )}
            <div style={s.fieldGroup}>
              <label style={s.label}>Your thoughts (optional)</label>
              <textarea style={s.textarea} placeholder="What do you think about this?" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
          </>
        )

      case 'job':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Job Title</label>
              <input style={s.input} placeholder="e.g. Senior Designer" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Company</label>
                <input style={s.input} placeholder="Company name" value={f('company')} onChange={e => setField('company', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Job Type</label>
                <select style={s.select} value={f('job_type') || 'Full-time'} onChange={e => setField('job_type', e.target.value)}>
                  {['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Salary Min (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('salary_min')} onChange={e => setField('salary_min', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Salary Max (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('salary_max')} onChange={e => setField('salary_max', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="Describe the role…" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Requirements</label>
              <textarea style={s.textarea} placeholder="Required skills and experience…" value={f('requirements')} onChange={e => setField('requirements', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Apply URL</label>
              <input style={s.input} placeholder="https://apply…" value={f('apply_url')} onChange={e => setField('apply_url', e.target.value)} />
            </div>
          </>
        )

      case 'event':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Event Title</label>
              <input style={s.input} placeholder="Event name…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Start Date &amp; Time</label>
                <input type="datetime-local" style={s.input} value={f('start_date')} onChange={e => setField('start_date', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>End Date &amp; Time</label>
                <input type="datetime-local" style={s.input} value={f('end_date')} onChange={e => setField('end_date', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="What's happening?" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Ticket Price (₮, 0 = free)</label>
                <input type="number" style={s.input} placeholder="0" value={f('price')} onChange={e => setField('price', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Max Attendees</label>
                <input type="number" style={s.input} placeholder="Unlimited" value={f('max_attendees')} onChange={e => setField('max_attendees', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Cover Image URL</label>
              <input style={s.input} placeholder="https://…" value={f('cover_image_url')} onChange={e => setField('cover_image_url', e.target.value)} />
            </div>
          </>
        )

      case 'service':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Service Title</label>
              <input style={s.input} placeholder="e.g. Logo Design" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="Describe your service…" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Price (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('price')} onChange={e => setField('price', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Delivery Time</label>
                <input style={s.input} placeholder="e.g. 3 days" value={f('delivery_time')} onChange={e => setField('delivery_time', e.target.value)} />
              </div>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>What&apos;s Included</label>
              <textarea style={s.textarea} placeholder="List everything included…" value={f('whats_included')} onChange={e => setField('whats_included', e.target.value)} />
            </div>
          </>
        )

      case 'product':
        return (
          <>
            {/* Product Type selector — Physical / Digital / Service */}
            <div style={s.fieldGroup}>
              <label style={s.label}>Product Type</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['physical', 'digital', 'service'] as const).map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setField('product_type', pt)}
                    style={{
                      flex: 1,
                      padding: '0.55rem 0.5rem',
                      borderRadius: 8,
                      border: (f('product_type') || 'physical') === pt ? '2px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)',
                      background: (f('product_type') || 'physical') === pt ? 'rgba(56,189,248,0.1)' : 'transparent',
                      color: (f('product_type') || 'physical') === pt ? '#38bdf8' : '#94a3b8',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textTransform: 'capitalize' as const,
                    }}
                  >
                    {pt === 'physical' ? '📦 Physical' : pt === 'digital' ? '⚡ Digital' : '🛠 Service'}
                  </button>
                ))}
              </div>
              <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: 5 }}>
                {(f('product_type') || 'physical') === 'physical' ? 'Item ships to buyer — delivery tracking available' :
                 (f('product_type') || 'physical') === 'digital' ? 'Instant delivery via download link or message' :
                 'Custom service offering — no physical delivery'}
              </p>
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Product Title</label>
              <input style={s.input} placeholder="Product name…" value={f('title')} onChange={e => setField('title', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Description</label>
              <textarea style={s.textarea} placeholder="Describe your product…" value={f('description')} onChange={e => setField('description', e.target.value)} />
            </div>
            <div style={s.row}>
              <div>
                <label style={s.label}>Price (₮)</label>
                <input type="number" style={s.input} placeholder="0" value={f('price')} onChange={e => setField('price', e.target.value)} />
              </div>
              <div>
                <label style={s.label}>Condition</label>
                <select style={s.select} value={f('condition') || 'New'} onChange={e => setField('condition', e.target.value)}>
                  {['New', 'Like New', 'Good', 'Fair'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {/* Delivery fields — only for physical products */}
            {(f('product_type') || 'physical') === 'physical' && (
              <div style={s.row}>
                <div>
                  <label style={s.label}>Estimated Delivery</label>
                  <select style={s.select} value={f('delivery_days') || ''} onChange={e => setField('delivery_days', e.target.value)}>
                    <option value="">Select delivery time…</option>
                    <option value="1">Next day (1 day)</option>
                    <option value="2">2 days</option>
                    <option value="3">3 days</option>
                    <option value="5">5 days</option>
                    <option value="7">1 week</option>
                    <option value="14">2 weeks</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Shipping Info</label>
                  <input style={s.input} placeholder="e.g. Nationwide, tracked" value={f('shipping')} onChange={e => setField('shipping', e.target.value)} />
                </div>
              </div>
            )}
            <div style={s.fieldGroup}>
              <label style={s.label}>Image URLs (one per line)</label>
              <textarea style={{ ...s.textarea, minHeight: '80px' }} placeholder="https://image1.com&#10;https://image2.com" value={f('images')} onChange={e => setField('images', e.target.value)} />
            </div>

            {/* ── Delivery Zone (physical products only) ── */}
            {(f('product_type') || 'physical') === 'physical' && (
              <div style={{ marginTop: '24px', padding: '16px', borderRadius: '12px', border: '1px solid #374151', background: '#0f172a' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: '#f3f4f6', marginTop: 0 }}>
                  🚚 Delivery Zone <span style={{ color: '#ef4444', fontSize: '12px' }}>required</span>
                </h3>
                <p style={{ color: '#9ca3af', fontSize: '13px', marginBottom: '16px', marginTop: 0 }}>
                  Let buyers know where you can deliver to.
                </p>

                {/* Scope radio buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                  {(['local', 'national', 'international', 'worldwide'] as const).map((scope) => (
                    <label key={scope} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', color: '#e5e7eb' }}>
                      <input
                        type="radio"
                        name="deliveryScope"
                        value={scope}
                        checked={deliveryScope === scope}
                        onChange={() => setDeliveryScope(scope)}
                        style={{ accentColor: '#3b82f6', marginTop: '2px', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '14px' }}>
                        {scope === 'local' && <><strong>📍 Local</strong> — set a delivery radius on the map</>}
                        {scope === 'national' && <><strong>🏴 National</strong> — deliver within a country</>}
                        {scope === 'international' && <><strong>✈️ International</strong> — select specific countries</>}
                        {scope === 'worldwide' && <><strong>🌍 Worldwide</strong> — deliver anywhere</>}
                      </span>
                    </label>
                  ))}
                </div>

                {/* Local: interactive map picker */}
                {deliveryScope === 'local' && (
                  <div style={{ marginBottom: '16px' }}>
                    <DeliveryZonePicker value={deliveryZone} onChange={setDeliveryZone} />
                  </div>
                )}

                {/* National: single country */}
                {deliveryScope === 'national' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#9ca3af', fontSize: '13px', marginBottom: '6px' }}>Country</label>
                    <select
                      value={deliveryCountries[0] || 'IE'}
                      onChange={(e) => setDeliveryCountries([e.target.value])}
                      style={{ ...s.select, maxWidth: '300px' }}
                    >
                      {COUNTRY_OPTIONS.map((c) => (
                        <option key={c.code} value={c.code}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* International: checkbox list (replaces broken <select multiple> on iOS) */}
                {deliveryScope === 'international' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', color: '#9ca3af', fontSize: '13px', marginBottom: '6px' }}>
                      Select countries
                    </label>
                    {deliveryCountries.length > 0 && (
                      <p style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '8px', marginTop: 0 }}>
                        {deliveryCountries.length} countr{deliveryCountries.length === 1 ? 'y' : 'ies'} selected: {deliveryCountries.join(', ')}
                      </p>
                    )}
                    <div style={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      border: '1px solid #374151',
                      borderRadius: 8,
                      background: '#0f172a',
                    }}>
                      {COUNTRY_OPTIONS.map((c) => {
                        const checked = deliveryCountries.includes(c.code)
                        return (
                          <label key={c.code} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #1f2937',
                            background: checked ? 'rgba(56,189,248,0.08)' : 'transparent',
                          }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setDeliveryCountries((prev) =>
                                  checked ? prev.filter((x) => x !== c.code) : [...prev, c.code]
                                )
                              }
                              style={{ accentColor: '#38bdf8', width: 18, height: 18, flexShrink: 0 }}
                            />
                            <span style={{ fontSize: 14, color: '#e5e7eb' }}>{c.name}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Delivery notes */}
                <div style={{ marginTop: '12px' }}>
                  <label style={{ display: 'block', color: '#9ca3af', fontSize: '13px', marginBottom: '6px' }}>
                    Delivery notes (optional, max 200 chars)
                  </label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value.slice(0, 200))}
                    placeholder="e.g. Free delivery on orders over €50, 2-3 business days…"
                    rows={3}
                    style={{ ...s.textarea, minHeight: 'unset' }}
                  />
                  <p style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
                    {deliveryNotes.length}/200
                  </p>
                </div>
              </div>
            )}
          </>
        )

      case 'poll':
        return (
          <>
            <div style={s.fieldGroup}>
              <label style={s.label}>Question</label>
              <input style={s.input} placeholder="What do you want to know?" value={f('question')} onChange={e => setField('question', e.target.value)} />
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Options (2–4)</label>
              {pollOptions.map((opt, i) => (
                <div key={i} style={{ ...s.pollOption, alignItems: 'center' }}>
                  <input
                    style={{ ...s.input, flex: 1, marginBottom: 0 }}
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={e => {
                      const next = [...pollOptions]
                      next[i] = e.target.value
                      setPollOptions(next)
                    }}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      style={{
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: '36px', height: '36px',
                        background: 'rgba(248,113,113,0.1)',
                        border: '1px solid rgba(248,113,113,0.25)',
                        borderRadius: '8px',
                        color: '#f87171', cursor: 'pointer', fontSize: '1.1rem',
                        lineHeight: 1,
                      }}
                      onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                    >×</button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button style={s.btnSecondary} onClick={() => setPollOptions([...pollOptions, ''])}>+ Add option</button>
              )}
            </div>
            <div style={s.fieldGroup}>
              <label style={s.label}>Duration</label>
              <select style={s.select} value={f('duration') || '7d'} onChange={e => setField('duration', e.target.value)}>
                {['1d', '3d', '7d', '14d'].map(d => <option key={d} value={d}>{d === '1d' ? '1 day' : d === '3d' ? '3 days' : d === '7d' ? '7 days' : '14 days'}</option>)}
              </select>
            </div>
          </>
        )

      default:
        return null
    }
  }

  const renderPreview = () => {
    switch (selectedType) {
      case 'text':
        return (
          <div style={s.previewCard}>
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {f('content') || 'Your text post will appear here.'}
            </div>
          </div>
        )

      case 'article':
        return (
          <div style={s.previewCard}>
            {f('cover_image_url') && <img src={f('cover_image_url')} alt="" style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '8px', marginBottom: '1rem' }} />}
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.75rem' }}>{f('title') || 'Untitled Article'}</h1>
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{f('body') || 'No content yet.'}</div>
          </div>
        )

      case 'poll':
        return (
          <div style={s.previewCard}>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#f1f5f9', marginBottom: '1rem' }}>{f('question') || 'Your question here'}</div>
            {pollOptions.filter(o => o.trim()).map((opt, i) => (
              <div key={i} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '0.65rem 1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#cbd5e1' }}>
                {opt}
              </div>
            ))}
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem' }}>⏱ Ends in {f('duration') || '7d'}</div>
          </div>
        )

      case 'photo': {
        const photoUrls = uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : (uploadedMediaUrl ? [uploadedMediaUrl] : [])
        return (
          <div style={s.previewCard}>
            {photoUrls.length > 0 ? (
              <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '1px solid #334155', background: '#020617', marginBottom: '0.9rem' }}>
                <img src={photoUrls[0]} alt="Preview" style={{ width: '100%', maxHeight: '420px', objectFit: 'contain', display: 'block' }} />
                {renderTextOverlay(false)}
                {photoUrls.length > 1 && (
                  <div style={{ position: 'absolute', right: 10, top: 10, background: 'rgba(15,23,42,0.82)', color: '#f8fafc', borderRadius: 999, padding: '4px 9px', fontSize: '0.78rem', fontWeight: 800 }}>
                    1/{photoUrls.length}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#64748b', marginBottom: '0.75rem' }}>Upload photos to preview your carousel.</div>
            )}
            {photoUrls.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: '0.8rem' }}>
                {photoUrls.map((_, i) => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? '#38bdf8' : '#475569' }} />)}
              </div>
            )}
            <div style={{ fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {f('caption') || 'Your caption will appear here.'}
            </div>
          </div>
        )
      }

      case 'job':
        return (
          <div style={s.previewCard}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>{f('title') || 'Job Title'}</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>{f('company')} · {f('job_type') || 'Full-time'}</div>
            {(f('salary_min') || f('salary_max')) && <div style={{ color: '#38bdf8', fontSize: '0.85rem', marginTop: '0.25rem' }}>₮{f('salary_min')} – ₮{f('salary_max')}</div>}
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.75rem', whiteSpace: 'pre-wrap' }}>{f('description')}</div>
          </div>
        )

      case 'event':
        return (
          <div style={s.previewCard}>
            {f('cover_image_url') && <img src={f('cover_image_url')} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />}
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>{f('title') || 'Event Title'}</div>
            {f('start_date') && <div style={{ color: '#38bdf8', fontSize: '0.85rem', marginTop: '0.25rem' }}>📅 {new Date(f('start_date')).toLocaleString()}</div>}
            {location && <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>📍 {location}</div>}
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.75rem' }}>{f('description')}</div>
          </div>
        )

      case 'service':
      case 'product':
        return (
          <div style={s.previewCard}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f1f5f9' }}>{f('title') || (selectedType === 'service' ? 'Service Title' : 'Product Title')}</div>
            <div style={{ color: '#38bdf8', fontSize: '1rem', fontWeight: 700, marginTop: '0.25rem' }}>₮{f('price') || '0'}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.88rem', marginTop: '0.75rem' }}>{f('description')}</div>
          </div>
        )

      case 'link':
        return (
          <div style={s.previewCard}>
            {linkPreview ? (
              <>
                {linkPreview.image && <img src={linkPreview.image} alt="" style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '8px', marginBottom: '0.75rem' }} />}
                <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{linkPreview.title}</div>
                {linkPreview.description && <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>{linkPreview.description}</div>}
                <div style={{ color: '#38bdf8', fontSize: '0.8rem', marginTop: '0.4rem' }}>{f('url')}</div>
              </>
            ) : (
              <div style={{ color: '#64748b' }}>Enter a URL to see preview</div>
            )}
          </div>
        )

      default:
        return (
          <div style={s.previewCard}>
            <div style={{ color: '#64748b' }}>Preview will appear here</div>
          </div>
        )
    }
  }

  // ── Page render ──────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      {/* Toast */}
      <div style={s.toast(showToast)}>{toast}</div>

      <h1 style={s.heading}>Create</h1>
      <p style={s.subtext}>Choose a format to get started</p>

      {/* Type grid */}
      <div style={s.grid}>
        {POST_TYPES.map(({ type, icon, label, desc }) => (
          <button
            key={type}
            style={s.typeCard(selectedType === type)}
            onClick={() => {
              setSelectedType(type)
              setPreview(false)
            }}
          >
            <span style={s.typeIcon}>{icon}</span>
            <span style={s.typeLabel(selectedType === type)}>{label}</span>
            <span style={s.typeDesc}>{desc}</span>
          </button>
        ))}
      </div>

      {/* Form */}
      {selectedType && renderForm()}
    </div>
  )
}
