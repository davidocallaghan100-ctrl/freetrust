'use client'
import { useState, useRef, useEffect, useCallback, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'
import { trackEvent, trackEventOnce } from '@/lib/analytics'
import GifPicker from '@/components/gifs/GifPicker'
import GifContent from '@/components/gifs/GifContent'
import { appendGifMarker, type GifResult } from '@/lib/gifs'
import { FEED_AUDIO_PLAY_EVENT, announceFeedAudioPlayback, generateFeedPlayerId } from '@/lib/feed/audioCoordinator'
import { useMusicPlayer, FREETRUST_LOGO_SRC as GLOBAL_FREETRUST_LOGO_SRC } from '@/context/MusicPlayerContext'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReactionType = 'trust' | 'love' | 'insightful' | 'collab'

type ReactionCounts = { trust: number; love: number; insightful: number; collab: number; total: number }

export type FeedPost = {
  id: string
  user_id?: string
  author_id?: string
  content: string | null
  title?: string | null
  link_url?: string | null
  type: string
  media_url: string | null
  media_urls?: string[] | null      // multiple photos
  media_type?: string | null
  metadata?: Record<string, unknown>
  created_at: string
  updated_at?: string | null
  like_count?: number
  likes_count?: number
  comment_count?: number
  comments_count?: number
  save_count?: number
  saves_count?: number
  share_count?: number
  view_count?: number
  views_count?: number
  liked?: boolean
  saved?: boolean
  trust_score?: number
  reactions?: { trust: number; love: number; insightful: number; collab: number; total: number }
  user_reaction?: ReactionType | null
  top_comment?: { id: string; content: string; author_name: string | null } | null
  profiles: {
    id?: string
    full_name: string | null
    avatar_url: string | null
    username?: string | null
    trust_balance?: number | null
    is_verified?: boolean | null
    verified_at?: string | null
    verification_status?: string | null
    profile_verification_status?: string | null
    profile_identity_verified_at?: string | null
  } | null
  // Display override — when present, the header renders the org's
  // logo + name + link to /organisations/{slug} in place of the
  // human author's profile block. `profiles` stays set so we can
  // still show a "via @authorFirstName" subtitle for accountability.
  // See supabase/migrations/20260414000001_feed_posts_posted_as_org.sql
  // for the underlying column.
  posted_as_organisation_id?: string | null
  posted_as_organisation?: {
    id: string
    name: string
    slug: string | null
    logo_url: string | null
  } | null
  // Poll vote data (only present when type === 'poll')
  poll_vote_counts?: Record<number, number> | null
  user_poll_vote?: number | null
}

type LinkPreviewData = {
  url: string
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  hostname: string
}

export type SpotifyTrackData = {
  id?: string | null
  name: string | null
  artists: string | null
  image?: string | null
  url: string
  previewUrl?: string | null
  previewSource?: 'spotify' | 'itunes' | null
}

type TextOverlayData = {
  text: string
  style: 'classic' | 'story' | 'neon' | 'caption' | 'minimal'
  position: 'top' | 'center' | 'bottom'
}

export const REACTIONS: { type: ReactionType; emoji: string; label: string; color: string }[] = [
  { type: 'trust',      emoji: '👍', label: 'Trust',      color: 'var(--ft-accent)' },
  { type: 'love',       emoji: '❤️', label: 'Love',       color: '#f472b6' },
  { type: 'insightful', emoji: '💡', label: 'Insightful', color: '#fbbf24' },
  { type: 'collab',     emoji: '🤝', label: 'Collab',     color: '#34d399' },
]

const EMPTY_REACTION_COUNTS: ReactionCounts = { trust: 0, love: 0, insightful: 0, collab: 0, total: 0 }

function normaliseReactionCounts(counts: Partial<ReactionCounts> | null | undefined): ReactionCounts {
  const next = {
    trust: Math.max(0, Number(counts?.trust ?? 0)),
    love: Math.max(0, Number(counts?.love ?? 0)),
    insightful: Math.max(0, Number(counts?.insightful ?? 0)),
    collab: Math.max(0, Number(counts?.collab ?? 0)),
  }
  return { ...next, total: Math.max(0, Number(counts?.total ?? (next.trust + next.love + next.insightful + next.collab))) }
}

function moveReactionCount(counts: ReactionCounts, from: ReactionType | null, to: ReactionType | null): ReactionCounts {
  const next = normaliseReactionCounts(counts)
  if (from) next[from] = Math.max(0, next[from] - 1)
  if (to) next[to] = next[to] + 1
  next.total = next.trust + next.love + next.insightful + next.collab
  return next
}

type Comment = {
  id: string
  content: string
  created_at: string
  like_count?: number
  profiles: { id?: string; full_name: string | null; avatar_url: string | null; username?: string | null; is_verified?: boolean | null; verified_at?: string | null; verification_status?: string | null; profile_verification_status?: string | null; profile_identity_verified_at?: string | null } | null
  posted_as_organisation_id?: string | null
  posted_as_organisation?: { id: string; name: string; slug: string | null; logo_url: string | null } | null
  liked_by_me?: boolean
}

function isVerifiedProfile(profile: FeedPost['profiles'] | Comment['profiles']) {
  return profile?.profile_verification_status === 'verified'
}

function InlineVerifiedBadge() {
  return (
    <span
      title="Profile details verified by FreeTrust"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: 'rgba(52,211,153,0.16)',
        border: '1px solid rgba(52,211,153,0.42)',
        color: '#34d399',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >✓</span>
  )
}

function metadataString(metadata: FeedPost['metadata'] | null | undefined, key: string): string | null {
  const value = metadata?.[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function metadataBoolean(metadata: FeedPost['metadata'] | null | undefined, key: string): boolean {
  return metadata?.[key] === true
}

function normaliseAuthorHref(href: string | null): string | null {
  if (!href) return null
  // Keep feed-card author links inside FreeTrust. External company websites
  // remain available from the job detail page instead of being routed through
  // Next's internal Link component.
  return href.startsWith('/') ? href : null
}

function getAuthorDisplayOverride(metadata: FeedPost['metadata'] | null | undefined) {
  const name = metadataString(metadata, 'feed_author_name')
  if (!name) return null
  return {
    name,
    avatar_url: metadataString(metadata, 'feed_author_avatar_url'),
    href: normaliseAuthorHref(metadataString(metadata, 'feed_author_href')),
    subtitle: metadataString(metadata, 'feed_author_subtitle'),
    hidePersonalByline: metadataBoolean(metadata, 'feed_hide_personal_byline'),
    suppressOwnerMenu: metadataBoolean(metadata, 'feed_suppress_owner_menu'),
  }
}

type FeedIdentity =
  | { type: 'personal'; id: string; name: string; username: string | null; avatar_url: string | null }
  | { type: 'org'; id: string; name: string; slug: string | null; logo_url: string | null; userRole?: string | null }

const FEED_IDENTITY_KEY = 'freetrust.feed.identity.v1'
const IDENTITY_STEP_TIMEOUT_MS = 3000
const EMPTY_POSTGREST_LIST = { data: [], error: null, count: null, status: 200, statusText: 'timeout fallback' }
const EMPTY_POSTGREST_SINGLE = { data: null, error: null, count: null, status: 200, statusText: 'timeout fallback' }

type FeedIdentityOptions = {
  personal: Extract<FeedIdentity, { type: 'personal' }> | null
  pages: Array<Extract<FeedIdentity, { type: 'org' }>>
}

let feedIdentityOptionsPromise: Promise<FeedIdentityOptions> | null = null

function withIdentityTimeout<T>(promise: PromiseLike<T>, fallback: T, timeoutMs = IDENTITY_STEP_TIMEOUT_MS): Promise<T> {
  return new Promise(resolve => {
    const timer = window.setTimeout(() => resolve(fallback), timeoutMs)
    Promise.resolve(promise)
      .then(value => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        window.clearTimeout(timer)
        resolve(fallback)
      })
  })
}

async function fetchJsonWithIdentityTimeout<T>(url: string, init: RequestInit, fallback: T): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), IDENTITY_STEP_TIMEOUT_MS)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return await res.json().catch(() => fallback) as T
  } catch {
    return fallback
  } finally {
    window.clearTimeout(timer)
  }
}

function normaliseIdentityPages(pages: Array<Extract<FeedIdentity, { type: 'org' }>>) {
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

async function loadFeedIdentityOptions(force = false): Promise<FeedIdentityOptions> {
  if (force) feedIdentityOptionsPromise = null
  if (feedIdentityOptionsPromise) return feedIdentityOptionsPromise
  feedIdentityOptionsPromise = (async () => {
    const supabase = createClient()
    const sessionResult = await withIdentityTimeout(
      supabase.auth.getSession(),
      { data: { session: null }, error: null }
    )
    const session = sessionResult.data.session
    const user = session?.user ?? null
    if (!user) return { personal: null, pages: [] }

    const profileResult = await withIdentityTimeout(
      supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', user.id)
        .maybeSingle(),
      EMPTY_POSTGREST_SINGLE
    )
    const profile = profileResult.data

    const personal: Extract<FeedIdentity, { type: 'personal' }> = {
      type: 'personal',
      id: user.id,
      name: (profile?.full_name as string | null) || (profile?.username as string | null) || 'My profile',
      username: (profile?.username as string | null) ?? null,
      avatar_url: (profile?.avatar_url as string | null) ?? null,
    }

    let pages: Array<Extract<FeedIdentity, { type: 'org' }>> = []
    try {
      const data = await fetchJsonWithIdentityTimeout(
        '/api/organisations/mine',
        {
          cache: 'no-store',
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
        },
        { organisations: [] as Array<{ id: string; name: string; slug: string | null; logo_url: string | null; userRole?: string | null }> }
      ) as { organisations?: Array<{ id: string; name: string; slug: string | null; logo_url: string | null; userRole?: string | null }> }
      pages = normaliseIdentityPages((data.organisations ?? []).map(page => ({ type: 'org', ...page })))
    } catch {
      pages = []
    }

    if (pages.length === 0) {
      const membershipsResult = await withIdentityTimeout(
        supabase
          .from('organisation_members')
          .select('organisation_id, role')
          .eq('user_id', user.id)
          .in('role', ['owner', 'admin']),
        EMPTY_POSTGREST_LIST
      )
      const memberships = membershipsResult.data

      const roleByOrgId = new Map<string, string>()
      const orgIds = (memberships ?? [])
        .map(membership => {
          const organisationId = (membership as { organisation_id?: string | null }).organisation_id
          const role = (membership as { role?: string | null }).role
          if (organisationId && role) roleByOrgId.set(organisationId, role)
          return organisationId
        })
        .filter((id): id is string => Boolean(id))

      const directPages: Array<Extract<FeedIdentity, { type: 'org' }>> = []
      if (orgIds.length > 0) {
        const orgsResult = await withIdentityTimeout(
          supabase
            .from('organisations')
            .select('id, name, slug, logo_url')
            .in('id', orgIds)
            .eq('status', 'active'),
          EMPTY_POSTGREST_LIST
        )
        const orgs = orgsResult.data

        directPages.push(...((orgs ?? []) as Array<{ id: string; name: string; slug: string | null; logo_url: string | null }>).map(org => ({
          type: 'org' as const,
          id: org.id,
          name: org.name,
          slug: org.slug,
          logo_url: org.logo_url,
          userRole: roleByOrgId.get(org.id) ?? 'admin',
        })))
      }

      const createdOrgsResult = await withIdentityTimeout(
        supabase
          .from('organisations')
          .select('id, name, slug, logo_url')
          .eq('creator_id', user.id)
          .eq('status', 'active'),
        EMPTY_POSTGREST_LIST
      )
      const createdOrgs = createdOrgsResult.data

      directPages.push(...((createdOrgs ?? []) as Array<{ id: string; name: string; slug: string | null; logo_url: string | null }>).map(org => ({
        type: 'org' as const,
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo_url: org.logo_url,
        userRole: 'owner',
      })))

      pages = normaliseIdentityPages(directPages)
    }

    return { personal, pages }
  })().catch(() => ({ personal: null, pages: [] }))
  feedIdentityOptionsPromise.then(options => {
    if (!options.personal && options.pages.length === 0) feedIdentityOptionsPromise = null
  }).catch(() => { feedIdentityOptionsPromise = null })
  return feedIdentityOptionsPromise
}

function readFeedIdentity(): FeedIdentity | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(FEED_IDENTITY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeedIdentity
    if (parsed?.type === 'org' && parsed.id && parsed.name) return parsed
    if (parsed?.type === 'personal' && parsed.id) return parsed
  } catch { /* ignore bad storage */ }
  return null
}

function mergeCurrentIdentityOption(options: FeedIdentityOptions, current: FeedIdentity | null): FeedIdentityOptions {
  if (!current) return options
  if (current.type === 'personal') {
    return { ...options, personal: options.personal ?? current }
  }
  if (options.pages.some(page => page.id === current.id)) return options
  return { ...options, pages: normaliseIdentityPages([...options.pages, current]) }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTime(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric' })
}

export const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  text:      { label: '✏️ Post',      color: 'var(--ft-text-secondary)', bg: 'rgba(148,163,184,0.1)' },
  video:     { label: '🎬 Video',     color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  short:     { label: '📱 Short',     color: '#f472b6', bg: 'rgba(244,114,182,0.1)' },
  photo:     { label: '📷 Photo',     color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  music:     { label: '🎵 Music',     color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  article:   { label: '📰 Article',   color: 'var(--ft-accent)', bg: 'rgba(56,189,248,0.1)'  },
  listing:   { label: '🛍️ Listing',  color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  service:   { label: '🛠 Service',   color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  product:   { label: '📦 Product',   color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  job:       { label: '💼 Job',       color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  event:     { label: '📅 Event',     color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  activity:  { label: '🏃 Activity',  color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)'  },
  poll:      { label: '📊 Poll',      color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
  link:      { label: '🔗 Link',      color: 'var(--ft-accent)', bg: 'rgba(56,189,248,0.1)'  },
  milestone: { label: '🏆 Milestone', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)'  },
}

function extractFirstUrl(text: string | null | undefined) {
  return text?.match(/https?:\/\/[^\s<]+/i)?.[0]?.replace(/[),.;!?]+$/, '') ?? null
}

function getSpotifyEmbedUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    if (!url.hostname.endsWith('spotify.com')) return null
    const parts = url.pathname.split('/').filter(Boolean)
    const embedIndex = parts[0] === 'embed' ? 1 : 0
    const type = parts[embedIndex]
    const id = parts[embedIndex + 1]
    const allowed = new Set(['track', 'album', 'playlist', 'artist', 'episode', 'show'])
    if (!type || !id || !allowed.has(type)) return null
    return `https://open.spotify.com/embed/${type}/${id.split('?')[0]}?utm_source=generator&theme=0`
  } catch {
    return null
  }
}

const MEDIA_URLS_MARKER_RE = /\n?\n?\[\[FT_MEDIA_URLS:([A-Za-z0-9_-]+)\]\]/
const SPOTIFY_MARKER_RE = /\n?\n?\[\[FT_SPOTIFY:([A-Za-z0-9_-]+)\]\]/
const TEXT_OVERLAY_MARKER_RE = /\n?\n?\[\[FT_TEXT_OVERLAY:([A-Za-z0-9_-]+)\]\]/

function stripInternalMarkers(text: string | null | undefined) {
  return text?.replace(MEDIA_URLS_MARKER_RE, '').replace(SPOTIFY_MARKER_RE, '').replace(TEXT_OVERLAY_MARKER_RE, '').trimEnd() ?? ''
}

function getInternalMarkers(text: string | null | undefined) {
  const markers = [text?.match(MEDIA_URLS_MARKER_RE)?.[0], text?.match(SPOTIFY_MARKER_RE)?.[0], text?.match(TEXT_OVERLAY_MARKER_RE)?.[0]].filter(Boolean)
  return markers.join('\n\n')
}

function getMediaUrlsMarker(text: string | null | undefined) {
  return text?.match(MEDIA_URLS_MARKER_RE)?.[0]?.trim() ?? ''
}

function getTextOverlayMarker(text: string | null | undefined) {
  return text?.match(TEXT_OVERLAY_MARKER_RE)?.[0]?.trim() ?? ''
}

function buildMediaUrlsMarker(urls: string[]) {
  const clean = Array.from(new Set(urls.map(url => url.trim()).filter(url => /^https?:\/\//i.test(url)))).slice(0, 10)
  if (clean.length <= 1) return ''
  return `[[FT_MEDIA_URLS:${encodeBase64UrlJson(clean)}]]`
}

function decodeBase64UrlJson<T>(encoded: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)
    const binary = window.atob(padded)
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as T
  } catch {
    return null
  }
}

function decodeMediaUrlsFromContent(text: string | null | undefined) {
  const encoded = text?.match(MEDIA_URLS_MARKER_RE)?.[1]
  if (!encoded || typeof window === 'undefined') return [] as string[]
  const parsed = decodeBase64UrlJson<unknown>(encoded)
  if (!Array.isArray(parsed)) return []
  return parsed.filter((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)).slice(0, 10)
}

function decodeSpotifyFromContent(text: string | null | undefined) {
  const encoded = text?.match(SPOTIFY_MARKER_RE)?.[1]
  if (!encoded || typeof window === 'undefined') return null
  const parsed = decodeBase64UrlJson<Partial<SpotifyTrackData>>(encoded)
  if (!parsed || typeof parsed.url !== 'string' || !/^https?:\/\//i.test(parsed.url)) return null
  return {
    id: typeof parsed.id === 'string' ? parsed.id : null,
    name: typeof parsed.name === 'string' ? parsed.name : null,
    artists: typeof parsed.artists === 'string' ? parsed.artists : null,
    image: typeof parsed.image === 'string' ? parsed.image : null,
    url: parsed.url,
    previewUrl: typeof parsed.previewUrl === 'string'
      ? parsed.previewUrl
      : typeof (parsed as Partial<SpotifyTrackData> & { preview_url?: unknown }).preview_url === 'string'
        ? (parsed as Partial<SpotifyTrackData> & { preview_url: string }).preview_url
        : null,
    previewSource: parsed.previewSource === 'spotify' || parsed.previewSource === 'itunes' ? parsed.previewSource : null,
  }
}

function decodeTextOverlayFromContent(text: string | null | undefined): TextOverlayData | null {
  const encoded = text?.match(TEXT_OVERLAY_MARKER_RE)?.[1]
  if (!encoded || typeof window === 'undefined') return null
  const parsed = decodeBase64UrlJson<Partial<TextOverlayData>>(encoded)
  const overlayText = typeof parsed?.text === 'string' ? parsed.text.trim().slice(0, 90) : ''
  if (!overlayText) return null
  const style = parsed?.style === 'story' || parsed?.style === 'neon' || parsed?.style === 'caption' || parsed?.style === 'minimal'
    ? parsed.style
    : 'classic'
  const position = parsed?.position === 'top' || parsed?.position === 'center' || parsed?.position === 'bottom'
    ? parsed.position
    : 'bottom'
  return { text: overlayText, style, position }
}

function encodeBase64UrlJson(value: unknown) {
  if (typeof window === 'undefined') return ''
  const json = JSON.stringify(value)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function buildSpotifyMarker(track: SpotifyTrackData | null, fallbackUrl: string) {
  const url = (track?.url ?? fallbackUrl).trim()
  if (!url.startsWith('http') || !track?.name) return ''
  const markerData = {
    id: track.id ?? null,
    name: track.name,
    artists: track.artists ?? null,
    image: track.image ?? null,
    url,
    previewUrl: track.previewUrl ?? null,
    previewSource: track.previewSource ?? null,
  }
  return `[[FT_SPOTIFY:${encodeBase64UrlJson(markerData)}]]`
}

function buildPhotoContentWithMarkers(caption: string, existingContent: string | null | undefined, track: SpotifyTrackData | null, fallbackUrl: string, mediaUrls?: string[]) {
  const mediaMarker = mediaUrls ? buildMediaUrlsMarker(mediaUrls) : getMediaUrlsMarker(existingContent)
  const parts = [caption.trimEnd(), mediaMarker, getTextOverlayMarker(existingContent), buildSpotifyMarker(track, fallbackUrl)].filter(Boolean)
  return parts.join('\n\n')
}

function ContentWithLinks({ text, expanded, canonicalUrl }: { text: string; expanded: boolean; canonicalUrl: string }) {
  const display = !expanded && text.length > 280 ? text.slice(0, 280) : text
  const parts = display.split(/(https?:\/\/[^\s<]+|@[a-zA-Z0-9][a-zA-Z0-9._-]{1,80})/g)
  return (
    <>
      {parts.map((part, i) => {
        if (/^https?:\/\//i.test(part)) {
          const href = part.replace(/[),.;!?]+$/, '')
          return <a key={`${part}-${i}`} href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ft-accent)', textDecoration: 'none' }}>{part}</a>
        }
        if (/^@[a-zA-Z0-9][a-zA-Z0-9._-]{1,80}$/.test(part)) {
          const slug = part.slice(1)
          return <Link key={`${part}-${i}`} href={`/organisations/${encodeURIComponent(slug)}`} style={{ color: '#c4b5fd', textDecoration: 'none', fontWeight: 700 }}>{part}</Link>
        }
        return <span key={`${part}-${i}`}>{part}</span>
      })}
      {!expanded && text.length > 280 ? <Link href={canonicalUrl} style={{ color: 'var(--ft-accent)', textDecoration: 'none' }}> …more</Link> : null}
    </>
  )
}

function SpotifyEmbed({ url }: { url: string }) {
  const embed = getSpotifyEmbedUrl(url)
  if (!embed) return null
  const isTrack = embed.includes('/track/') || embed.includes('/episode/')
  return (
    <div style={{ margin: '0 16px 12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(30,215,96,0.35)', background: 'var(--ft-bg)', boxShadow: '0 10px 30px rgba(30,215,96,0.08)' }}>
      <iframe
        src={embed}
        width="100%"
        height={isTrack ? 80 : 352}
        style={{ border: 0, display: 'block' }}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        title="Spotify player"
      />
    </div>
  )
}

function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null)
  const [failed, setFailed] = useState(false)

  const isInternalUrl = url.startsWith('/')

  useEffect(() => {
    if (!url || isInternalUrl || getSpotifyEmbedUrl(url)) return
    let cancelled = false
    setFailed(false)
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error('preview failed')))
      .then((data: { preview?: LinkPreviewData }) => { if (!cancelled) setPreview(data.preview ?? null) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [isInternalUrl, url])

  if (isInternalUrl) {
    return (
      <Link href={url} style={{ display: 'block', margin: '0 16px 12px', border: '1px solid var(--ft-border-strong)', borderRadius: '10px', padding: '12px 14px', color: 'var(--ft-accent)', textDecoration: 'none', fontSize: '13px', overflowWrap: 'anywhere', background: 'var(--ft-bg)' }}>
        🔗 {url}
      </Link>
    )
  }

  if (getSpotifyEmbedUrl(url)) return <SpotifyEmbed url={url} />
  if (failed) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', margin: '0 16px 12px', border: '1px solid var(--ft-border-strong)', borderRadius: '10px', padding: '12px 14px', color: 'var(--ft-accent)', textDecoration: 'none', fontSize: '13px', overflowWrap: 'anywhere' }}>
        🔗 {url.replace(/^https?:\/\//, '')}
      </a>
    )
  }
  if (!preview) return null
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        margin: '0 16px 12px',
        minHeight: 82,
        border: '1px solid var(--ft-border-strong)',
        borderRadius: '12px',
        overflow: 'hidden',
        textDecoration: 'none',
        background: 'var(--ft-bg)',
      }}
    >
      {preview.image ? (
        <img
          src={preview.image}
          alt=""
          style={{
            width: 86,
            minHeight: 86,
            maxHeight: 104,
            objectFit: 'cover',
            display: 'block',
            flexShrink: 0,
            background: '#020617',
          }}
        />
      ) : null}
      <div style={{ padding: '10px 12px', minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: '10px', color: 'var(--ft-accent)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 800, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.siteName ?? preview.hostname}</div>
        {preview.title ? <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--ft-text)', marginBottom: preview.description ? '4px' : 0, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview.title}</div> : null}
        {preview.description ? <div style={{ fontSize: '11px', color: 'var(--ft-text-secondary)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{preview.description}</div> : null}
      </div>
    </a>
  )
}

function textOverlayVisualStyle(style: TextOverlayData['style']): CSSProperties {
  if (style === 'story') {
    return { color: 'var(--ft-bg)', background: 'rgba(255,255,255,0.92)', borderRadius: 999, padding: '0.28em 0.72em', boxShadow: '0 14px 34px rgba(0,0,0,0.28)', fontWeight: 850 }
  }
  if (style === 'neon') {
    return { color: '#bbf7d0', fontWeight: 900, textShadow: '0 0 8px rgba(34,197,94,0.95), 0 0 24px rgba(56,189,248,0.55)' }
  }
  if (style === 'caption') {
    return { color: '#f8fafc', background: 'rgba(2,6,23,0.72)', borderRadius: 14, padding: '0.38em 0.72em', backdropFilter: 'blur(8px)', fontWeight: 800 }
  }
  if (style === 'minimal') {
    return { color: '#f8fafc', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', textShadow: '0 2px 10px rgba(0,0,0,0.75)' }
  }
  return { color: '#ffffff', fontWeight: 900, textShadow: '0 3px 14px rgba(0,0,0,0.9)', letterSpacing: '-0.03em' }
}

function textOverlayPositionStyle(position: TextOverlayData['position']): CSSProperties {
  if (position === 'top') return { alignItems: 'center', justifyContent: 'flex-start', paddingTop: '12%' }
  if (position === 'center') return { alignItems: 'center', justifyContent: 'center' }
  return { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '12%' }
}

function TextMediaOverlay({ overlay, compact = false }: { overlay: TextOverlayData | null; compact?: boolean }) {
  if (!overlay?.text) return null
  return (
    <div
      aria-label={`Text overlay: ${overlay.text}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        pointerEvents: 'none',
        display: 'flex',
        textAlign: 'center',
        paddingLeft: compact ? '8%' : '10%',
        paddingRight: compact ? '8%' : '10%',
        ...textOverlayPositionStyle(overlay.position),
      }}
    >
      <div style={{
        maxWidth: '100%',
        fontSize: compact ? 'clamp(1rem, 6vw, 1.65rem)' : 'clamp(1.35rem, 8vw, 2.5rem)',
        lineHeight: 1.05,
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        ...textOverlayVisualStyle(overlay.style),
      }}>
        {overlay.text}
      </div>
    </div>
  )
}

// ── Photo Carousel ────────────────────────────────────────────────────────────

function PhotoCarousel({ urls, alt, soundtrack, textOverlay, imageHref, imageBadge }: { urls: string[]; alt: string; soundtrack?: SpotifyTrackData | null; textOverlay?: TextOverlayData | null; imageHref?: string | null; imageBadge?: { label: string; href: string; ariaLabel: string } | null }) {
  const [index, setIndex] = useState(0)
  const [soundtrackEnabled, setSoundtrackEnabled] = useState(true)
  const [soundtrackPlaying, setSoundtrackPlaying] = useState(false)
  const [soundtrackNotice, setSoundtrackNotice] = useState('')
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const soundtrackEnabledRef = useRef(true)
  const soundtrackVisibleRef = useRef(false)
  const playerIdRef = useRef(generateFeedPlayerId('ft-soundtrack'))
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const count = urls.length
  const hasMultiple = count > 1
  const previewUrl = soundtrack?.previewUrl ?? null

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    audioRef.current?.pause()
    soundtrackEnabledRef.current = true
    soundtrackVisibleRef.current = false
    setSoundtrackEnabled(true)
    setSoundtrackPlaying(false)
    setSoundtrackNotice('')
  }, [soundtrack?.url])

  useEffect(() => {
    soundtrackEnabledRef.current = soundtrackEnabled
  }, [soundtrackEnabled])

  useEffect(() => {
    const stopForAnotherPost = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail
      if (detail?.playerId === playerIdRef.current) return
      const audio = audioRef.current
      if (!audio || audio.paused) return
      audio.pause()
      audio.currentTime = 0
      setSoundtrackPlaying(false)
    }
    window.addEventListener(FEED_AUDIO_PLAY_EVENT, stopForAnotherPost)
    return () => window.removeEventListener(FEED_AUDIO_PLAY_EVENT, stopForAnotherPost)
  }, [])

  const announceSoundtrackPlayback = () => {
    announceFeedAudioPlayback(playerIdRef.current)
  }

  const showSoundtrackNotice = (message: string) => {
    setSoundtrackNotice(message)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => setSoundtrackNotice(''), 3200)
  }

  const pauseSoundtrack = useCallback((resetToStart = false) => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    if (resetToStart) audio.currentTime = 0
    setSoundtrackPlaying(false)
  }, [])

  const playSoundtrack = useCallback(async (options?: { showNotice?: boolean }) => {
    if (!soundtrack?.name || !previewUrl || !soundtrackEnabledRef.current) return false
    const audio = audioRef.current
    if (!audio) return false
    if (!audio.paused) return true

    try {
      announceSoundtrackPlayback()
      audio.muted = false
      audio.volume = 1
      await audio.play()
      setSoundtrackPlaying(true)
      setSoundtrackNotice('')
      return true
    } catch {
      setSoundtrackPlaying(false)
      if (options?.showNotice) showSoundtrackNotice('Your browser blocked automatic audio — tap once to enable')
      return false
    }
  }, [previewUrl, soundtrack?.name])

  useEffect(() => {
    if (!previewUrl) return
    const node = carouselRef.current
    if (!node) return

    const observer = new IntersectionObserver(entries => {
      const entry = entries[0]
      const isMeaningfullyVisible = Boolean(entry?.isIntersecting && entry.intersectionRatio >= 0.55)
      soundtrackVisibleRef.current = isMeaningfullyVisible
      if (isMeaningfullyVisible) {
        void playSoundtrack({ showNotice: false })
      } else {
        pauseSoundtrack(true)
      }
    }, { threshold: [0, 0.55, 0.85] })

    observer.observe(node)
    return () => observer.disconnect()
  }, [pauseSoundtrack, playSoundtrack, previewUrl])

  useEffect(() => {
    if (!previewUrl) return
    const retryAfterUserGesture = () => {
      if (!soundtrackVisibleRef.current || !soundtrackEnabledRef.current) return
      const audio = audioRef.current
      if (!audio || !audio.paused) return
      void playSoundtrack({ showNotice: false })
    }
    document.addEventListener('pointerdown', retryAfterUserGesture, { passive: true, capture: true })
    document.addEventListener('touchstart', retryAfterUserGesture, { passive: true, capture: true })
    document.addEventListener('keydown', retryAfterUserGesture, { capture: true })
    return () => {
      document.removeEventListener('pointerdown', retryAfterUserGesture, { capture: true })
      document.removeEventListener('touchstart', retryAfterUserGesture, { capture: true })
      document.removeEventListener('keydown', retryAfterUserGesture, { capture: true })
    }
  }, [playSoundtrack, previewUrl])

  const toggleSoundtrack = async () => {
    if (!soundtrack?.name) return
    if (previewUrl) {
      if (soundtrackEnabledRef.current) {
        soundtrackEnabledRef.current = false
        setSoundtrackEnabled(false)
        pauseSoundtrack(true)
        return
      }

      soundtrackEnabledRef.current = true
      setSoundtrackEnabled(true)
      await playSoundtrack({ showNotice: true })
      return
    }

    soundtrackEnabledRef.current = false
    setSoundtrackEnabled(false)
    setSoundtrackPlaying(false)
    showSoundtrackNotice('Preview unavailable for this song')
  }

  const goTo = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), count - 1))
  }

  const handleTouchEnd = (clientX: number) => {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - clientX
    touchStartX.current = null
    if (Math.abs(delta) < 38) return
    if (delta > 0) goTo(index + 1)
    else goTo(index - 1)
  }

  return (
    <div ref={carouselRef} className="ft-photo-carousel" style={{ marginBottom: '12px' }}>
      <div
        className="ft-photo-carousel-frame"
        style={{ position: 'relative', overflow: 'hidden', borderRadius: '14px', background: '#020617', border: '1px solid rgba(51,65,85,0.75)', touchAction: 'pan-y' }}
        onTouchStart={e => { touchStartX.current = e.touches[0]?.clientX ?? null }}
        onTouchEnd={e => handleTouchEnd(e.changedTouches[0]?.clientX ?? 0)}
      >
        <div style={{ display: 'flex', transform: `translateX(-${index * 100}%)`, transition: 'transform 260ms ease', width: '100%' }}>
          {urls.map((url, i) => {
            const image = (
              <img
                src={url}
                alt={`${alt} ${i + 1}`}
                loading="lazy"
                style={{ width: '100%', height: 'auto', maxHeight: 'none', objectFit: 'cover', display: 'block', background: '#020617' }}
              />
            )
            return (
              <div key={`${url}-${i}`} style={{ flex: '0 0 100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617' }}>
                {imageHref ? (
                  <Link
                    href={imageHref}
                    aria-label={`Open ${alt} service page`}
                    style={{ display: 'block', width: '100%', color: 'inherit', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    {image}
                  </Link>
                ) : image}
              </div>
            )
          })}
        </div>
        <TextMediaOverlay overlay={textOverlay ?? null} />

        {imageBadge ? (
          <Link
            href={imageBadge.href}
            aria-label={imageBadge.ariaLabel}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 34,
              padding: '7px 12px',
              borderRadius: 999,
              background: 'rgba(2,6,23,0.78)',
              border: '1px solid rgba(56,189,248,0.65)',
              boxShadow: '0 12px 28px rgba(0,0,0,0.35), 0 0 22px rgba(56,189,248,0.18)',
              color: '#e0f2fe',
              fontSize: 12,
              fontWeight: 850,
              letterSpacing: '0.02em',
              lineHeight: 1,
              textDecoration: 'none',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <span aria-hidden="true" style={{ color: 'var(--ft-accent)', fontSize: 13 }}>🛠</span>
            {imageBadge.label}
          </Link>
        ) : null}

        {soundtrack?.name && previewUrl ? (
          <button
            type="button"
            onClick={toggleSoundtrack}
            aria-label={`${soundtrackEnabled ? 'Mute' : 'Enable'} ${soundtrack.name} in the FreeTrust feed`}
            title={`${soundtrack.name}${soundtrack.artists ? ` · ${soundtrack.artists}` : ''}`}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              width: 42,
              height: 42,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              background: soundtrackEnabled ? 'rgba(22,163,74,0.92)' : 'rgba(2,6,23,0.76)',
              border: soundtrackEnabled ? '1px solid rgba(187,247,208,0.85)' : '1px solid rgba(30,215,96,0.55)',
              boxShadow: soundtrackEnabled ? '0 12px 32px rgba(0,0,0,0.34), 0 0 30px rgba(34,197,94,0.38)' : '0 12px 32px rgba(0,0,0,0.34), 0 0 24px rgba(30,215,96,0.18)',
              color: '#bbf7d0',
              backdropFilter: 'blur(8px)',
              zIndex: 3,
              fontSize: 20,
              lineHeight: 1,
              cursor: 'pointer',
              transform: 'none',
            }}
          >
            {soundtrackEnabled ? '🔊' : '🔇'}
          </button>
        ) : null}

        {previewUrl ? (
          <audio
            ref={audioRef}
            src={previewUrl}
            preload="auto"
            autoPlay
            loop
            onEnded={() => setSoundtrackPlaying(false)}
            onPause={() => setSoundtrackPlaying(false)}
            onPlay={() => setSoundtrackPlaying(true)}
          />
        ) : null}

        {hasMultiple && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5, background: 'rgba(2,6,23,0.76)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 999, padding: '4px 9px', fontSize: 12, fontWeight: 800 }}>
            {index + 1}/{count}
          </div>
        )}

        {hasMultiple && index > 0 && (
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Previous photo"
            style={{ position: 'absolute', left: 10, top: '50%', zIndex: 5, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(2,6,23,0.72)', color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >‹</button>
        )}

        {hasMultiple && index < count - 1 && (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Next photo"
            style={{ position: 'absolute', right: 10, top: '50%', zIndex: 5, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(2,6,23,0.72)', color: '#fff', fontSize: 24, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
          >›</button>
        )}
      </div>

      {soundtrack?.name ? (
        <div
          className="ft-soundtrack-strip"
          aria-label={`Song: ${soundtrack.name}${soundtrack.artists ? ` by ${soundtrack.artists}` : ''}`}
          style={{ margin: '8px auto 0', maxWidth: '92%', height: 32, borderRadius: 999, overflow: 'hidden', border: '1px solid rgba(30,215,96,0.38)', background: 'linear-gradient(90deg, rgba(2,6,23,0.94), rgba(5,46,22,0.72), rgba(2,6,23,0.94))', boxShadow: '0 10px 24px rgba(0,0,0,0.28), 0 0 18px rgba(30,215,96,0.14)', display: 'flex', alignItems: 'center', color: '#dcfce7' }}
        >
          <style>{`
            @keyframes ftSoundtrackMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
            @media (prefers-reduced-motion: reduce) { .ft-soundtrack-marquee { animation: none !important; transform: translateX(0) !important; } }
          `}</style>
          <div className="ft-soundtrack-marquee" style={{ display: 'inline-flex', width: 'max-content', minWidth: '200%', whiteSpace: 'nowrap', animation: 'ftSoundtrackMarquee 14s linear infinite' }}>
            {[0, 1].map(i => (
              <span key={i} aria-hidden={i === 1} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 26px', fontSize: 13, fontWeight: 800, letterSpacing: '0.01em' }}>
                <span style={{ color: '#22c55e' }}>♪</span>
                <span>{soundtrack.name}</span>
                {soundtrack.artists ? <span style={{ color: '#86efac', fontWeight: 700 }}>· {soundtrack.artists}</span> : null}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {soundtrackNotice ? (
        <div style={{ margin: '6px auto 0', maxWidth: '92%', color: '#86efac', fontSize: 11, textAlign: 'center', lineHeight: 1.3 }}>
          {soundtrackNotice}
        </div>
      ) : null}

      {hasMultiple && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 }}>
          {urls.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Show photo ${i + 1}`}
              style={{ width: i === index ? 18 : 7, height: 7, borderRadius: 999, border: 'none', padding: 0, background: i === index ? 'var(--ft-accent)' : 'var(--ft-text-faint)', cursor: 'pointer', transition: 'all 160ms ease' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Music Player ───────────────────────────────────────────────────────────────
// Dedicated "Music" post type — the track itself is the post (distinct from
// the Spotify/iTunes background-soundtrack attachment on Photo posts above,
// which is unrelated and untouched). Centerpiece is the real FreeTrust logo
// with a beat-synced visualizer driven by a real Web Audio AnalyserNode
// reading the actual playback of whichever source is present: an uploaded
// audio file (post.media_url) or a Spotify/iTunes preview clip
// (spotifyTrack.previewUrl). Tap-to-play (not autoplay) — this is deliberate
// content the user is choosing to listen to, not ambient background sound,
// so it doesn't need the IntersectionObserver-driven autoplay complexity the
// soundtrack feature has.
//
// Playback itself is owned by the single global player in
// context/MusicPlayerContext.tsx (mounted once at the app-shell level) so a
// track keeps playing across route navigation instead of stopping when this
// card unmounts. This component just calls into that shared player and
// renders itself as "active" (progress, playing state, visualizer reacting
// to the real AnalyserNode) only when its own track is the one currently
// loaded — comparing by post id, not audio URL, since two different posts
// can share the same Spotify preview URL. The provider already participates
// in the platform-wide single-audio-source rule via FEED_AUDIO_PLAY_EVENT,
// so this component doesn't need its own coordinator listener anymore.
const FREETRUST_LOGO_SRC = GLOBAL_FREETRUST_LOGO_SRC
const MUSIC_VISUALIZER_BAR_COUNT = 40

export function MusicPlayer({ postId, src, track, title }: { postId: string; src: string | null; track: SpotifyTrackData | null; title?: string | null }) {
  const { current, playing: globalPlaying, blocked, currentTime: globalCurrentTime, duration: globalDuration, play, seek, getAnalyser } = useMusicPlayer()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const isActiveTrack = current?.id === postId
  const playing = isActiveTrack && globalPlaying
  const currentTime = isActiveTrack ? globalCurrentTime : 0
  const duration = isActiveTrack ? globalDuration : 0

  const displayName = track?.name ?? title ?? 'Untitled track'
  const displayArtist = track?.artists ?? null
  const artwork = track?.image ?? null

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx2d = canvas?.getContext('2d')
    if (!canvas || !ctx2d) return
    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const baseRadius = size * 0.26

    ctx2d.clearRect(0, 0, size, size)

    const analyser = isActiveTrack ? getAnalyser() : null
    const isActive = playing && Boolean(analyser)
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null
    if (analyser && freqData) analyser.getByteFrequencyData(freqData)

    // Boost small amplitudes with a sub-linear power curve (amp^0.55) so
    // quieter passages still read as visibly "wavy" instead of flat —
    // raw linear frequency-bin averages tend to sit low and look static
    // even when the track is clearly audible.
    const rawAvgAmp = freqData ? freqData.reduce((sum, v) => sum + v, 0) / freqData.length / 255 : 0
    const avgAmp = Math.pow(rawAvgAmp, 0.55)
    const idlePulse = 0.5 + 0.5 * Math.sin(Date.now() / 900)
    const glowStrength = isActive ? 0.35 + avgAmp * 1.1 : 0.18 + idlePulse * 0.08

    const glow = ctx2d.createRadialGradient(cx, cy, baseRadius * 0.4, cx, cy, size * 0.5)
    glow.addColorStop(0, `rgba(56,189,248,${0.45 * glowStrength})`)
    glow.addColorStop(0.55, `rgba(129,140,248,${0.28 * glowStrength})`)
    glow.addColorStop(1, 'rgba(15,23,42,0)')
    ctx2d.fillStyle = glow
    ctx2d.fillRect(0, 0, size, size)

    const barCount = MUSIC_VISUALIZER_BAR_COUNT
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2
      let amp: number
      if (freqData) {
        const bin = freqData[Math.floor((i / barCount) * freqData.length)] ?? 0
        // Same power-curve boost as the glow above, plus a touch of
        // per-bar jitter so adjacent bars don't move in perfect lockstep
        // — reads as a livelier, wavier motion rather than a smooth ring.
        amp = Math.pow(bin / 255, 0.6) * (0.85 + 0.3 * Math.sin(Date.now() / 140 + i * 1.3))
        amp = Math.max(0, Math.min(1, amp))
      } else {
        amp = 0.08 + 0.05 * Math.sin(Date.now() / 500 + i)
      }
      const barLen = baseRadius * 0.18 + amp * baseRadius * 1.55
      const innerR = baseRadius * 1.08
      const outerR = innerR + barLen
      const x1 = cx + Math.cos(angle) * innerR
      const y1 = cy + Math.sin(angle) * innerR
      const x2 = cx + Math.cos(angle) * outerR
      const y2 = cy + Math.sin(angle) * outerR
      ctx2d.strokeStyle = isActive
        ? `rgba(${56 + amp * 120},189,${248 - amp * 40},${0.55 + amp * 0.45})`
        : 'rgba(96,165,250,0.28)'
      ctx2d.lineWidth = Math.max(2, size * 0.014)
      ctx2d.lineCap = 'round'
      ctx2d.beginPath()
      ctx2d.moveTo(x1, y1)
      ctx2d.lineTo(x2, y2)
      ctx2d.stroke()
    }

    const peak = freqData ? Math.pow(Math.max(...Array.from(freqData)) / 255, 0.6) : idlePulse * 0.15
    ctx2d.beginPath()
    ctx2d.arc(cx, cy, baseRadius * (1 + peak * 0.4), 0, Math.PI * 2)
    ctx2d.strokeStyle = isActive ? `rgba(186,230,253,${0.35 + peak * 0.5})` : 'rgba(148,163,184,0.22)'
    ctx2d.lineWidth = 2 + (isActive ? peak * 3 : 0)
    ctx2d.stroke()

    rafRef.current = requestAnimationFrame(drawFrame)
  }, [playing, isActiveTrack, getAnalyser])

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawFrame)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [drawFrame])

  const togglePlay = async () => {
    if (!src) return
    await play({ id: postId, src, title: displayName, artist: displayArtist, artwork })
  }

  const formatTimeMs = (secs: number) => {
    if (!Number.isFinite(secs) || secs <= 0) return '0:00'
    const m = Math.floor(secs / 60)
    const sec = Math.floor(secs % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const seekTo = (clientX: number, target: HTMLDivElement) => {
    if (!isActiveTrack || !duration) return
    const rect = target.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    seek(frac * duration)
  }

  if (!src) {
    return (
      <div style={{ borderRadius: 16, border: '1px solid var(--ft-border-strong)', background: 'var(--ft-bg)', padding: '1.25rem', textAlign: 'center', color: 'var(--ft-text-tertiary)', fontSize: 13, marginBottom: 12 }}>
        🎵 Track unavailable
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 12, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(56,189,248,0.28)', background: 'linear-gradient(160deg, rgba(8,47,73,0.55), rgba(2,6,23,0.98))', padding: '1.5rem 1.25rem' }}>
      <div style={{ position: 'relative', width: 168, height: 168, margin: '0 auto 1.1rem' }}>
        <canvas ref={canvasRef} width={168} height={168} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? `Pause ${displayName}` : `Play ${displayName}`}
          style={{
            position: 'absolute',
            inset: 0,
            margin: 'auto',
            width: 92,
            height: 92,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            border: '2px solid rgba(186,230,253,0.55)',
            background: artwork ? `center/cover no-repeat url(${artwork})` : '#0b1220',
            cursor: 'pointer',
            padding: 0,
            overflow: 'hidden',
            boxShadow: '0 0 0 6px rgba(15,23,42,0.9), 0 12px 30px rgba(0,0,0,0.5)',
          }}
        >
          {!artwork && (
            <img src={FREETRUST_LOGO_SRC} alt="FreeTrust" style={{ width: '68%', height: '68%', objectFit: 'contain', margin: '16% auto', display: 'block' }} />
          )}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(2,6,23,0.32)',
              fontSize: 30,
              color: '#f0f9ff',
            }}
          >
            {playing ? '⏸' : '▶'}
          </span>
        </button>
      </div>

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#f0f9ff', fontWeight: 850, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
        {displayArtist ? <div style={{ color: '#93c5fd', fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayArtist}</div> : null}
        <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 11.5, marginTop: 6 }}>
          {formatTimeMs(currentTime)}{duration ? ` / ${formatTimeMs(duration)}` : track?.previewUrl ? ' / 0:30 preview' : ''}
        </div>
        <div
          role="slider"
          aria-label="Seek track position"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration || 0)}
          aria-valuenow={Math.round(currentTime)}
          onClick={e => seekTo(e.clientX, e.currentTarget)}
          style={{
            position: 'relative',
            height: 6,
            marginTop: 10,
            borderRadius: 999,
            background: 'var(--ft-bg)',
            border: '1px solid var(--ft-border-strong)',
            overflow: 'hidden',
            cursor: duration ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: duration ? `${Math.min(100, (currentTime / duration) * 100)}%` : '0%',
              minWidth: currentTime > 0 ? '6px' : 0,
              borderRadius: 999,
              background: 'linear-gradient(90deg, #38bdf8, #818cf8)',
              transition: playing ? 'none' : 'width 0.2s ease-out',
            }}
          />
        </div>
        {isActiveTrack && blocked ? (
          <div style={{ marginTop: 8, color: '#fbbf24', fontSize: 11.5 }}>Your browser blocked autoplay — tap ▶ again to start.</div>
        ) : null}
      </div>
    </div>
  )
}

// ── Video Player ──────────────────────────────────────────────────────────────

function VideoPlayer({ src, isShort, textOverlay }: { src: string; isShort: boolean; textOverlay?: TextOverlayData | null }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const autoPausedRef = useRef(false)
  const userPausedRef = useRef(false)
  const audioEnabledRef = useRef(true)
  const posterCapturedRef = useRef(false)
  const playerIdRef = useRef(generateFeedPlayerId('ft-video'))
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState<number | null>(null)
  const [muted, setMuted] = useState(false)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [previewReady, setPreviewReady] = useState(false)
  const [nativeAspect, setNativeAspect] = useState<number | null>(null)

  // Videos are uploaded in many native formats (portrait 9:16, square, landscape
  // 16:9, etc). The feed frame used to force every video into a single fixed
  // aspect ratio (9/16 for shorts, 4/5 for everything else) with `objectFit:
  // cover`. Whenever a video's real aspect ratio didn't match that box, cover
  // cropped its left/right (or top/bottom) edges — cutting off any burned-in
  // captions/text near those edges. Fix: size the frame to the video's actual
  // aspect ratio (clamped to sane feed bounds) and use `contain` so the full
  // frame, including edge text, is always visible with no cropping.
  const defaultRatio = isShort ? 9 / 16 : 4 / 5
  const minRatio = isShort ? 9 / 16 : 0.5 // never narrower than a tall portrait
  const maxRatio = isShort ? 4 / 5 : 16 / 9 // never wider than a full landscape
  const effectiveRatio = nativeAspect
    ? Math.min(maxRatio, Math.max(minRatio, nativeAspect))
    : defaultRatio
  const frameStyle = isShort
    ? { aspectRatio: `${effectiveRatio}`, minHeight: '460px', maxHeight: 'min(78vh, 640px)' }
    : { aspectRatio: `${effectiveRatio}`, minHeight: '360px', maxHeight: 'min(70vh, 560px)' }
  // Only crop (cover) when the frame's clamped ratio matches the video's real
  // ratio closely enough that no meaningful crop occurs; otherwise letterbox
  // (contain) against a blurred poster backdrop so nothing is ever cut off.
  const needsLetterbox = nativeAspect !== null && Math.abs(nativeAspect - effectiveRatio) > 0.03

  const capturePosterFrame = useCallback(() => {
    const el = videoRef.current
    if (!el || posterCapturedRef.current || el.videoWidth === 0 || el.videoHeight === 0) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = el.videoWidth
      canvas.height = el.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      posterCapturedRef.current = true
      setPosterUrl(dataUrl)
      setPreviewReady(true)
    } catch {
      // Cross-origin video frames can be blocked from canvas capture.
      // The loaded video element still displays its own first frame.
      setPreviewReady(true)
    }
  }, [])

  useEffect(() => {
    posterCapturedRef.current = false
    userPausedRef.current = false
    autoPausedRef.current = false
    setPosterUrl(null)
    setPreviewReady(false)
    setPlaying(false)
    setDuration(null)
  }, [src])

  // Yield to whichever feed post (video or photo-carousel soundtrack) most
  // recently announced itself as audible — keeps sound to a single source
  // across the whole feed. Muting (rather than pausing) keeps this video's
  // own playback/looping unaffected, matching what happens when a user
  // manually mutes via the speaker toggle below.
  useEffect(() => {
    const yieldToAnotherPlayer = (event: Event) => {
      const detail = (event as CustomEvent<{ playerId?: string }>).detail
      if (detail?.playerId === playerIdRef.current) return
      const el = videoRef.current
      if (!el || el.muted) return
      el.muted = true
      audioEnabledRef.current = false
      setMuted(true)
    }
    window.addEventListener(FEED_AUDIO_PLAY_EVENT, yieldToAnotherPlayer)
    return () => window.removeEventListener(FEED_AUDIO_PLAY_EVENT, yieldToAnotherPlayer)
  }, [])

  // Auto-play video when it is visibly in the feed. Sound is enabled by
  // default so users hear feed videos without manually unmuting. Browser
  // autoplay policies can still block sound before a user gesture, so we
  // gracefully fall back to muted autoplay instead of leaving the card paused.
  useEffect(() => {
    const el = videoRef.current
    if (!el) return

    const tryAutoplay = () => {
      const shouldMute = !audioEnabledRef.current
      if (!shouldMute) announceFeedAudioPlayback(playerIdRef.current)
      el.muted = shouldMute
      setMuted(shouldMute)
      el.play()
        .then(() => {
          autoPausedRef.current = false
          setPlaying(true)
        })
        .catch(() => {
          if (!shouldMute) {
            el.muted = true
            setMuted(true)
            el.play()
              .then(() => {
                autoPausedRef.current = false
                setPlaying(true)
              })
              .catch(() => {})
          }
        })
    }

    // Debounce the play/pause decision: during a fast scroll flick, the
    // observer can fire many times in quick succession as the card crosses
    // the 8 threshold breakpoints below. Acting on every single fire caused
    // rapid play()/pause() thrashing on a video that hadn't finished
    // buffering from the previous play() call yet — a real contributor to
    // the reported "glitching" (visible stutter), independent of the
    // preload change above. Requiring the visibility state to hold for a
    // short window before acting lets a quick flick-past skip playback
    // entirely instead of starting-then-immediately-stopping a fetch.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1
          const elementCenter = entry.boundingClientRect.top + (entry.boundingClientRect.height / 2)
          const visibleTop = Math.max(0, entry.boundingClientRect.top)
          const visibleBottom = Math.min(viewportHeight, entry.boundingClientRect.bottom)
          const visiblePx = Math.max(0, visibleBottom - visibleTop)
          const mostlyInView = entry.isIntersecting && entry.intersectionRatio >= 0.24
          const centerNearViewport = elementCenter > viewportHeight * 0.12 && elementCenter < viewportHeight * 0.88
          const visiblyInFeed = entry.isIntersecting && visiblePx >= Math.min(240, entry.boundingClientRect.height * 0.3)
          const shouldAutoplay = (mostlyInView || (centerNearViewport && visiblyInFeed)) && !userPausedRef.current

          if (shouldAutoplay) {
            tryAutoplay()
          } else {
            if (!el.paused) {
              autoPausedRef.current = true
              el.pause()
              setPlaying(false)
            }
            if (!entry.isIntersecting || entry.intersectionRatio < 0.08) {
              userPausedRef.current = false
            }
          }
        }, 180)
      },
      { threshold: [0, 0.08, 0.18, 0.24, 0.35, 0.5, 0.75, 1] }
    )
    observer.observe(el)
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      observer.disconnect()
    }
  }, [])

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    if (el.paused) {
      userPausedRef.current = false
      el.play().then(() => setPlaying(true)).catch(() => {})
    } else {
      userPausedRef.current = !autoPausedRef.current
      el.pause()
      setPlaying(false)
    }
  }

  const formatDur = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const playIfVisible = () => {
    const el = videoRef.current
    if (!el || userPausedRef.current) return
    const rect = el.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1
    const visibleTop = Math.max(0, rect.top)
    const visibleBottom = Math.min(viewportHeight, rect.bottom)
    const visiblePx = Math.max(0, visibleBottom - visibleTop)
    if (visiblePx < Math.min(240, rect.height * 0.3)) return
    const shouldMute = !audioEnabledRef.current
    if (!shouldMute) announceFeedAudioPlayback(playerIdRef.current)
    el.muted = shouldMute
    setMuted(shouldMute)
    el.play()
      .then(() => {
        autoPausedRef.current = false
        setPlaying(true)
      })
      .catch(() => {
        if (!shouldMute) {
          el.muted = true
          setMuted(true)
          el.play()
            .then(() => {
              autoPausedRef.current = false
              setPlaying(true)
            })
            .catch(() => {})
        }
      })
  }

  const toggleMute = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const el = videoRef.current
    const nextMuted = !muted
    audioEnabledRef.current = !nextMuted
    if (el) {
      if (!nextMuted) announceFeedAudioPlayback(playerIdRef.current)
      el.muted = nextMuted
      if (!nextMuted && el.paused) {
        el.play().then(() => setPlaying(true)).catch(() => {})
      }
    }
    setMuted(nextMuted)
  }

  return (
    <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', background: '#000', marginBottom: '12px', cursor: 'pointer', width: '100%', ...frameStyle }} onClick={togglePlay}>
      {!previewReady && !playing && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: posterUrl ? `center / cover no-repeat url(${posterUrl})` : 'linear-gradient(135deg, #020617, var(--ft-bg) 45%, #020617)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: 'var(--ft-text-tertiary)', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Loading preview…</span>
        </div>
      )}
      {needsLetterbox && posterUrl && (
        <div
          aria-hidden
          style={{ position: 'absolute', inset: 0, zIndex: 0, background: `center / cover no-repeat url(${posterUrl})`, filter: 'blur(28px) brightness(0.55)', transform: 'scale(1.15)' }}
        />
      )}
      <video
        ref={videoRef}
        src={src}
        autoPlay
        muted={muted}
        playsInline
        loop={isShort}
        poster={posterUrl ?? undefined}
        crossOrigin="anonymous"
        // Pre-buffer real media data (not just metadata) so playback has a
        // head start once this card scrolls into view — reduces the
        // stutter/rebuffer ("glitching") that showed up with metadata-only
        // preload combined with the IntersectionObserver-driven autoplay
        // below. Browsers still respect data-saver settings; this only
        // raises the *hint* priority, it doesn't force a download.
        preload="auto"
        onLoadedMetadata={() => {
          const el = videoRef.current
          setDuration(el?.duration ?? null)
          if (el && el.videoWidth > 0 && el.videoHeight > 0) {
            setNativeAspect(el.videoWidth / el.videoHeight)
          }
          if (el && !posterCapturedRef.current && Number.isFinite(el.duration) && el.duration > 0.2) {
            try { el.currentTime = Math.min(0.12, el.duration / 8) } catch { /* first-frame seek can fail on some browsers */ }
          }
        }}
        onLoadedData={() => { setPreviewReady(true); capturePosterFrame() }}
        onCanPlay={playIfVisible}
        onSeeked={capturePosterFrame}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'block', objectFit: needsLetterbox ? 'contain' : 'cover', background: needsLetterbox ? 'transparent' : (posterUrl && !previewReady ? `center / cover no-repeat url(${posterUrl})` : '#000') }}
      />
      <TextMediaOverlay overlay={textOverlay ?? null} compact={isShort} />
      {/* Play overlay */}
      {!playing && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '22px', marginLeft: '4px' }}>▶</span>
          </div>
        </div>
      )}
      {/* Duration badge */}
      {duration !== null && !playing && (
        <div style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 5, background: 'rgba(0,0,0,0.7)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px', color: '#fff', fontWeight: 600 }}>
          {formatDur(duration)}
        </div>
      )}
      {/* Mute toggle while playing */}
      {playing && (
        <button
          onClick={toggleMute}
          style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 5, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label={muted ? 'Enable video sound' : 'Disable video sound'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </div>
  )
}

// ── Share Sheet ───────────────────────────────────────────────────────────────

function ShareSheet({ postId, canonicalPath, text, onClose }: { postId: string; canonicalPath: string; text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = typeof window !== 'undefined' ? `${window.location.origin}${canonicalPath}` : canonicalPath
  const encoded = encodeURIComponent(url)
  const encodedText = encodeURIComponent(text.slice(0, 100) + ' — via FreeTrust')

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* fallback */ }
  }

  const options = [
    { icon: '🔗', label: copied ? 'Copied!' : 'Copy link', action: copy },
    { icon: '💬', label: 'WhatsApp', action: () => window.open(`https://wa.me/?text=${encodedText}%20${encoded}`, '_blank') },
    { icon: '𝕏', label: 'Twitter / X', action: () => window.open(`https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}`, '_blank') },
    { icon: '💼', label: 'LinkedIn', action: () => window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`, '_blank') },
    { icon: '📧', label: 'Email', action: () => window.open(`mailto:?subject=Check this out on FreeTrust&body=${encodedText}%20${encoded}`, '_blank') },
  ]

  return (
    <div style={{ marginTop: '12px', background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--ft-surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--ft-text)' }}>Share post</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ft-text-tertiary)', fontSize: '16px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
      </div>
      {options.map(opt => (
        <button
          key={opt.label}
          onClick={opt.action}
          style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--ft-surface)', color: 'var(--ft-text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.1s' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.06)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ fontSize: '18px', width: '24px', textAlign: 'center', flexShrink: 0 }}>{opt.icon}</span>
          <span>{opt.label}</span>
          {opt.label === 'Copy link' && (
            <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--ft-text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
              /feed/{postId.slice(0, 8)}…
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ── Main PostCard ─────────────────────────────────────────────────────────────

export default function PostCard({
  post,
  expanded = false,
  currentUserId,
  onDelete,
}: {
  post: FeedPost
  expanded?: boolean
  currentUserId?: string
  onDelete?: (postId: string) => void
}) {
  const authorId = post.user_id ?? post.author_id ?? ''
  const likeInitial    = post.likes_count    ?? post.like_count    ?? 0
  const commentInitial = post.comments_count ?? post.comment_count ?? 0
  const saveInitial    = post.saves_count    ?? post.save_count    ?? 0

  const [liked,             setLiked]             = useState(post.liked ?? false)
  const [likeCount,         setLikeCount]         = useState(likeInitial)
  const [saved,             setSaved]             = useState(post.saved ?? false)
  const [saveCount,         setSaveCount]         = useState(saveInitial)
  const [showComments,      setShowComments]      = useState(expanded)
  const [comments,          setComments]          = useState<Comment[]>([])
  const [commentCount,      setCommentCount]      = useState(commentInitial)
  const [newComment,        setNewComment]        = useState('')
  const [selectedCommentGif,setSelectedCommentGif]= useState<GifResult | null>(null)
  const [submitting,        setSubmitting]        = useState(false)
  const [commentExpanded,   setCommentExpanded]   = useState(false)
  const [showShare,         setShowShare]         = useState(false)
  const [shareCount,        setShareCount]        = useState(post.share_count ?? 0)
  const [showMenu,          setShowMenu]          = useState(false)
  const [deleting,          setDeleting]          = useState(false)
  const [deleted,           setDeleted]           = useState(false)
  const [editing,           setEditing]           = useState(false)
  const [editedContent,     setEditedContent]     = useState(stripInternalMarkers(post.content))
  const [editedTitle,       setEditedTitle]       = useState(post.title ?? '')
  const [editedSpotifyTrack,setEditedSpotifyTrack]= useState<SpotifyTrackData | null>(null)
  const [editedSpotifyUrl,  setEditedSpotifyUrl]  = useState('')
  const [editSpotifyQuery,  setEditSpotifyQuery]  = useState('')
  const [editSpotifyResults,setEditSpotifyResults]= useState<SpotifyTrackData[]>([])
  const [editSpotifyLoading,setEditSpotifyLoading]= useState(false)
  const [editSpotifyConfigured,setEditSpotifyConfigured]= useState(true)
  const [editedPhotoUrls,  setEditedPhotoUrls]  = useState<string[]>([])
  const [editPhotoUploading,setEditPhotoUploading]= useState(false)
  const [editPhotoProgress,setEditPhotoProgress]= useState('')
  const [savingEdit,        setSavingEdit]        = useState(false)
  const [postContent,       setPostContent]       = useState(post.content)
  const [postTitle,         setPostTitle]         = useState(post.title ?? null)
  const [postMediaUrl,      setPostMediaUrl]      = useState(post.media_url)
  const [postLinkUrl,       setPostLinkUrl]       = useState(post.link_url ?? null)
  const [postUpdatedAt,     setPostUpdatedAt]     = useState(post.updated_at ?? null)
  const [feedIdentity,      setFeedIdentity]      = useState<FeedIdentity | null>(null)
  const [identityOptions,   setIdentityOptions]   = useState<FeedIdentityOptions>({ personal: null, pages: [] })
  const [identityLoading,   setIdentityLoading]   = useState(false)
  const [identityOpen,      setIdentityOpen]      = useState(false)

  // Poll state (optimistic updates)
  const [localVoteCounts, setLocalVoteCounts] = useState<Record<number, number>>(post.poll_vote_counts ?? {})
  const [localUserVote, setLocalUserVote] = useState<number | null>(post.user_poll_vote ?? null)

  // Reactions
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [userReaction, setUserReaction]   = useState<ReactionType | null>(post.user_reaction ?? null)
  const [reactionCounts, setReactionCounts] = useState<ReactionCounts>(() => normaliseReactionCounts(post.reactions ?? EMPTY_REACTION_COUNTS))
  const [reactionTotal, setReactionTotal] = useState(() => normaliseReactionCounts(post.reactions ?? EMPTY_REACTION_COUNTS).total)
  const reactionPickerRef = useRef<HTMLDivElement | null>(null)
  const reactBtnWrapRef = useRef<HTMLDivElement | null>(null)
  const cardRef = useRef<HTMLElement | null>(null)
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null)
  const commentTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const identityPickerRef = useRef<HTMLDivElement | null>(null)
  const displayedIdentityOptions = mergeCurrentIdentityOption(identityOptions, feedIdentity)

  const refreshIdentityOptions = useCallback((force = false) => {
    if (!currentUserId) {
      setIdentityOptions({ personal: null, pages: [] })
      setFeedIdentity(null)
      setIdentityLoading(false)
      return () => {}
    }
    let cancelled = false
    setIdentityLoading(true)
    const hardStop = window.setTimeout(() => {
      if (!cancelled) setIdentityLoading(false)
    }, 4500)
    loadFeedIdentityOptions(force)
      .then(options => {
        if (cancelled) return
        setIdentityOptions(options)
        setFeedIdentity(current => {
          if (current) return current
          if (!options.personal) return null
          try {
            window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(options.personal))
          } catch { /* ignore storage */ }
          return options.personal
        })
      })
      .finally(() => {
        window.clearTimeout(hardStop)
        if (!cancelled) setIdentityLoading(false)
      })
    return () => {
      cancelled = true
      window.clearTimeout(hardStop)
    }
  }, [currentUserId])

  useEffect(() => {
    if (!currentUserId) {
      setFeedIdentity(null)
      setIdentityOptions({ personal: null, pages: [] })
      return
    }
    setFeedIdentity(readFeedIdentity())
    const onIdentityChange = (event: Event) => {
      const detail = (event as CustomEvent<FeedIdentity>).detail
      setFeedIdentity(detail ?? readFeedIdentity())
    }
    window.addEventListener('freetrust:feed-identity-change', onIdentityChange)
    window.addEventListener('storage', onIdentityChange)
    return () => {
      window.removeEventListener('freetrust:feed-identity-change', onIdentityChange)
      window.removeEventListener('storage', onIdentityChange)
    }
  }, [currentUserId])

  useEffect(() => refreshIdentityOptions(false), [refreshIdentityOptions])

  useEffect(() => {
    if (!identityOpen) return
    const selectedPageMissing = feedIdentity?.type === 'org' && !identityOptions.pages.some(page => page.id === feedIdentity.id)
    if (identityOptions.pages.length === 0 || selectedPageMissing) return refreshIdentityOptions(true)
  }, [identityOpen, feedIdentity, identityOptions.pages, refreshIdentityOptions])

  useEffect(() => {
    if (!identityOpen) return
    const close = (event: MouseEvent) => {
      if (identityPickerRef.current && !identityPickerRef.current.contains(event.target as Node)) {
        setIdentityOpen(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [identityOpen])

  const chooseFeedIdentity = (identity: FeedIdentity) => {
    setFeedIdentity(identity)
    setIdentityOpen(false)
    try {
      window.localStorage.setItem(FEED_IDENTITY_KEY, JSON.stringify(identity))
      window.dispatchEvent(new CustomEvent('freetrust:feed-identity-change', { detail: identity }))
    } catch { /* ignore storage */ }
  }

  // Close reaction picker on outside click
  useEffect(() => {
    if (!showReactionPicker) return
    const close = (e: MouseEvent) => {
      if (reactionPickerRef.current && !reactionPickerRef.current.contains(e.target as Node)) {
        setShowReactionPicker(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('click', close), 0)
    return () => { clearTimeout(timer); document.removeEventListener('click', close) }
  }, [showReactionPicker])

  const handleReact = async (type: ReactionType) => {
    setShowReactionPicker(false)
    // Optimistic update
    const wasReacted = userReaction
    const previousCounts = reactionCounts
    const previousTotal = reactionTotal
    const nextReaction = wasReacted === type ? null : type
    const optimisticCounts = moveReactionCount(previousCounts, wasReacted, nextReaction)
    if (wasReacted === type) {
      setUserReaction(null)
    } else if (wasReacted === null) {
      setUserReaction(type)
    } else {
      setUserReaction(type)
      // total stays the same — switched type
    }
    setReactionCounts(optimisticCounts)
    setReactionTotal(optimisticCounts.total)
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          posted_as_organisation_id: feedIdentity?.type === 'org' ? feedIdentity.id : null,
        }),
      })
      if (res.ok) {
        const data = await res.json() as { user_reaction: ReactionType | null; total: number; counts?: Partial<ReactionCounts> }
        setUserReaction(data.user_reaction)
        const freshCounts = data.counts ? normaliseReactionCounts({ ...data.counts, total: data.total }) : { ...optimisticCounts, total: data.total }
        setReactionCounts(freshCounts)
        setReactionTotal(freshCounts.total)
        if (nextReaction) {
          void trackEvent({
            userId: authorId,
            eventType: 'post_like',
            entityType: 'post',
            entityId: post.id,
            metadata: { title: postTitle ?? stripInternalMarkers(postContent)?.slice(0, 80) ?? null, reaction: nextReaction },
          })
        }
      } else {
        // Roll back
        setUserReaction(wasReacted)
        setReactionCounts(previousCounts)
        setReactionTotal(previousTotal)
      }
    } catch {
      setUserReaction(wasReacted)
      setReactionCounts(previousCounts)
      setReactionTotal(previousTotal)
    }
  }

  const authorDisplayOverride = getAuthorDisplayOverride(post.metadata)
  const isOwner = !!currentUserId && currentUserId === authorId && !authorDisplayOverride?.suppressOwnerMenu

  const startEditing = () => {
    setEditedContent(stripInternalMarkers(postContent))
    setEditedTitle(postTitle ?? '')
    setEditedSpotifyTrack(spotifyTrack ?? null)
    setEditedSpotifyUrl((spotifyTrack?.url ?? postLinkUrl ?? '').trim())
    setEditedPhotoUrls(mediaUrls)
    setEditPhotoProgress('')
    setEditSpotifyQuery('')
    setEditSpotifyResults([])
    setEditing(true)
    setShowMenu(false)
  }

  const cancelEditing = () => {
    setEditedContent(stripInternalMarkers(postContent))
    setEditedTitle(postTitle ?? '')
    setEditedSpotifyTrack(spotifyTrack ?? null)
    setEditedSpotifyUrl((spotifyTrack?.url ?? postLinkUrl ?? '').trim())
    setEditedPhotoUrls(mediaUrls)
    setEditPhotoProgress('')
    setEditSpotifyQuery('')
    setEditSpotifyResults([])
    setEditing(false)
  }

  const uploadEditedPhoto = async (rawFile: File) => {
    setEditPhotoUploading(true)
    setEditPhotoProgress('Uploading photo…')
    try {
      const file = await compressImage(rawFile, 2)
      const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
      const EXT_TO_MIME: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' }
      let fileType = file.type
      if (!fileType) {
        const ext = (file.name.split('.').pop() ?? '').toLowerCase()
        fileType = EXT_TO_MIME[ext] ?? ''
      }
      if (!IMAGE_TYPES.includes(fileType)) throw new Error(`Unsupported image type: ${fileType || 'unknown'}`)
      if (file.size > 10 * 1024 * 1024) throw new Error('Photo too large (max 10 MB)')

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Please sign in and try again')

      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif' } as Record<string, string>)[fileType] ?? 'jpg'
      const uidSafe = (user.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'anon'
      const randSafe = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, '') || Date.now().toString(36)
      const storagePath = `photo/${uidSafe}/${Date.now()}-${randSafe}.${ext}`
      const { error } = await supabase.storage.from('feed-media').upload(storagePath, file, { contentType: fileType, upsert: false, cacheControl: '31536000' })
      if (error) throw new Error(error.message)
      const { data } = supabase.storage.from('feed-media').getPublicUrl(storagePath)
      if (!data?.publicUrl) throw new Error('Could not resolve uploaded photo URL')
      setEditPhotoProgress('✓ Photo uploaded')
      return data.publicUrl
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      setEditPhotoProgress(`Upload failed — ${message}`)
      return null
    } finally {
      setEditPhotoUploading(false)
    }
  }

  const addEditedPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    const remaining = Math.max(0, 10 - editedPhotoUrls.length)
    const selected = Array.from(files).slice(0, remaining)
    if (selected.length === 0) {
      setEditPhotoProgress('Maximum 10 photos per post')
      return
    }
    const uploaded: string[] = []
    for (const file of selected) {
      const url = await uploadEditedPhoto(file)
      if (url) uploaded.push(url)
    }
    if (uploaded.length > 0) {
      setEditedPhotoUrls(prev => [...prev, ...uploaded].slice(0, 10))
      setEditPhotoProgress(`✓ ${uploaded.length} photo${uploaded.length === 1 ? '' : 's'} added`)
    }
  }

  const replaceEditedPhoto = async (index: number, file: File | null | undefined) => {
    if (!file) return
    const url = await uploadEditedPhoto(file)
    if (!url) return
    setEditedPhotoUrls(prev => prev.map((existing, i) => i === index ? url : existing))
    setEditPhotoProgress('✓ Photo replaced')
  }

  const removeEditedPhoto = (index: number) => {
    setEditedPhotoUrls(prev => prev.filter((_, i) => i !== index))
    setEditPhotoProgress('Photo removed — save to apply')
  }

  const moveEditedPhoto = (index: number, direction: -1 | 1) => {
    setEditedPhotoUrls(prev => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const searchEditSpotify = async (query: string) => {
    const q = query.trim()
    setEditSpotifyQuery(query)
    if (q.length < 2) {
      setEditSpotifyResults([])
      return
    }
    setEditSpotifyLoading(true)
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}`)
      const data = await res.json() as { tracks?: SpotifyTrackData[]; configured?: boolean }
      setEditSpotifyConfigured(data.configured !== false)
      setEditSpotifyResults(data.tracks ?? [])
    } catch {
      setEditSpotifyResults([])
    } finally {
      setEditSpotifyLoading(false)
    }
  }

  const selectEditSpotifyTrack = (track: SpotifyTrackData) => {
    setEditedSpotifyTrack(track)
    setEditedSpotifyUrl(track.url)
    setEditSpotifyQuery('')
    setEditSpotifyResults([])
  }

  const clearEditedSpotify = () => {
    setEditedSpotifyTrack(null)
    setEditedSpotifyUrl('')
    setEditSpotifyQuery('')
    setEditSpotifyResults([])
  }

  const handleDelete = async () => {
    if (!confirm('Delete this post? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/feed/posts/${post.id}`, { method: 'DELETE' })
      if (res.ok) { setDeleted(true); onDelete?.(post.id) }
    } catch { /* silent */ }
    finally { setDeleting(false); setShowMenu(false) }
  }

  const handleSaveEdit = async () => {
    setSavingEdit(true)
    try {
      const nextLinkUrl = post.type === 'photo'
        ? ((editedSpotifyTrack?.url ?? editedSpotifyUrl).trim().startsWith('http') ? (editedSpotifyTrack?.url ?? editedSpotifyUrl).trim() : null)
        : undefined
      const nextPhotoUrls = Array.from(new Set(editedPhotoUrls.map(url => url.trim()).filter(url => /^https?:\/\//i.test(url)))).slice(0, 10)
      const nextPrimaryPhotoUrl = nextPhotoUrls[0] ?? null
      const nextContent = post.type === 'photo'
        ? buildPhotoContentWithMarkers(editedContent, postContent, editedSpotifyTrack, editedSpotifyUrl, nextPhotoUrls)
        : editedContent
      const res = await fetch(`/api/feed/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: nextContent,
          title: editedTitle || undefined,
          ...(post.type === 'photo' ? { link_url: nextLinkUrl, media_url: nextPrimaryPhotoUrl, media_urls: nextPhotoUrls } : {}),
        }),
      })
      const data = await res.json().catch(() => ({} as { error?: string; post?: FeedPost }))
      if (!res.ok) {
        alert(data.error ?? 'Failed to edit post')
        return
      }
      const updated = data.post
      setPostContent(updated?.content ?? nextContent)
      setPostTitle(updated?.title ?? (editedTitle || null))
      if (post.type === 'photo') {
        setPostLinkUrl(updated?.link_url ?? nextLinkUrl)
        setPostMediaUrl(updated?.media_url ?? nextPrimaryPhotoUrl)
        setEditedPhotoUrls(nextPhotoUrls)
      }
      setPostUpdatedAt(updated?.updated_at ?? new Date().toISOString())
      setEditing(false)
    } catch {
      alert('Failed to edit post')
    } finally {
      setSavingEdit(false)
    }
  }

  const typeInfo  = TYPE_META[post.type] ?? TYPE_META.text

  // ── Canonical "read more" URL ─────────────────────────────────────────────
  // Jobs, events, and listings are synthesized by the feed API with a
  // prefixed id ("job-<uuid>", "event-<uuid>", "listing-<uuid>"). These
  // IDs don't exist in feed_posts so navigating to /feed/<prefixed-id>
  // returns a 404. Instead we derive the canonical destination URL:
  //   job-<uuid>     → /jobs/<uuid>
  //   event-<uuid>   → /events/<uuid>
  //   listing-<uuid> → /listings/<uuid>
  //   article-<uuid> → /articles/<uuid>
  //   activity-<uuid> → /experience-activities?activity=<uuid>
  //   <plain-uuid>   → /feed/<uuid>  (regular feed post)
  function getCanonicalUrl(postId: string, postType: string, linkUrl: string | null): string {
    const internalLink = typeof linkUrl === 'string' && linkUrl.startsWith('/') ? linkUrl : null
    const isCrossTableType = ['article', 'service', 'product', 'listing', 'job', 'event', 'activity'].includes(postType)
    if (internalLink && isCrossTableType) return internalLink
    if (postId.startsWith('job-'))     return `/jobs/${postId.slice(4)}`
    if (postId.startsWith('event-'))   return `/events/${postId.slice(6)}`
    if (postId.startsWith('service-')) return `/services/${postId.slice(8)}`
    if (postId.startsWith('listing-')) return `/listings/${postId.slice(8)}`
    if (postId.startsWith('article-')) return `/articles/${postId.slice(8)}`
    if (postId.startsWith('activity-')) return `/experience-activities?activity=${postId.slice(9)}`
    // For cross-table types without a prefix, use the type to route correctly
    if (postType === 'job')     return `/jobs/${postId}`
    if (postType === 'event')   return `/events/${postId}`
    if (postType === 'service') return `/services/${postId}`
    if (postType === 'product') return `/products/${postId}`
    if (postType === 'listing') return `/listings/${postId}`
    if (postType === 'activity') return `/experience-activities?activity=${postId}`
    return `/feed/${postId}`
  }
  const canonicalUrl = getCanonicalUrl(post.id, post.type, postLinkUrl)

  // ── Author display — "post as organisation" override ─────────────────────
  // When post.posted_as_organisation is set, the card renders with the
  // org's branding (logo, name, link to /organisations/{slug}) in the
  // header, and adds a small "via @humanName" subtitle so the author
  // is still visible for accountability. When unset (default — every
  // personal post), the header falls back to the author's profile as
  // before.
  const postedAsOrg = post.posted_as_organisation ?? null
  const humanName   = post.profiles?.full_name ?? post.profiles?.username ?? 'Unknown'
  const humanAvatar = post.profiles?.avatar_url ?? null
  const humanId     = post.profiles?.id ?? null
  const humanVerified = isVerifiedProfile(post.profiles)

  const name      = postedAsOrg ? postedAsOrg.name : (authorDisplayOverride?.name ?? humanName)
  const avatarUrl = postedAsOrg ? postedAsOrg.logo_url : (authorDisplayOverride?.avatar_url ?? humanAvatar)
  const trust     = (postedAsOrg || authorDisplayOverride) ? null : (post.profiles?.trust_balance ?? post.trust_score ?? null)
  // Link target — org profile for "as org" posts, personal profile
  // otherwise. Org links prefer slug, fall back to id if missing.
  const authorLinkHref = postedAsOrg
    ? (postedAsOrg.slug ? `/organisations/${postedAsOrg.slug}` : `/organisations/${postedAsOrg.id}`)
    : (authorDisplayOverride?.href ?? `/profile?id=${humanId ?? ''}`)

  // Build media URL array
  const mediaUrls: string[] = (() => {
    const fromContent = decodeMediaUrlsFromContent(postContent)
    if (fromContent.length > 0) return fromContent
    if (postMediaUrl !== post.media_url) return postMediaUrl ? [postMediaUrl] : []
    const fromMeta = (post.metadata?.media_urls ?? post.media_urls) as string[] | undefined
    if (fromMeta && fromMeta.length > 0) return fromMeta
    if (postMediaUrl) return [postMediaUrl]
    return []
  })()

  const isVideo = post.type === 'video' || post.type === 'short' ||
    (post.media_type ?? '').startsWith('video/')
  const isShort = post.type === 'short'
  const attachedUrl = postLinkUrl ?? (typeof post.metadata?.link_url === 'string' ? post.metadata.link_url : null) ?? extractFirstUrl(postContent)
  const spotifyMarkerEncoded = postContent?.match(SPOTIFY_MARKER_RE)?.[1] ?? ''
  const spotifyFromMarker = decodeSpotifyFromContent(postContent)
  const [fetchedSpotify, setFetchedSpotify] = useState<SpotifyTrackData | null>(null)
  const spotifyTrack = spotifyFromMarker
    ? {
        ...spotifyFromMarker,
        previewUrl: spotifyFromMarker.previewUrl ?? fetchedSpotify?.previewUrl ?? null,
        previewSource: spotifyFromMarker.previewSource ?? fetchedSpotify?.previewSource ?? null,
      }
    : fetchedSpotify
  const textOverlay = decodeTextOverlayFromContent(postContent)
  const displayContent = stripInternalMarkers(postContent)
  const isPhotoSpotifyAttachment = post.type === 'photo' && Boolean(attachedUrl && getSpotifyEmbedUrl(attachedUrl))

  useEffect(() => {
    if (!authorId || currentUserId === authorId) return
    const title = postTitle ?? stripInternalMarkers(postContent)?.slice(0, 80) ?? null
    const payload = {
      userId: authorId,
      eventType: 'post_view' as const,
      entityType: 'post' as const,
      entityId: post.id,
      metadata: { title, type: post.type },
    }
    if (expanded) {
      trackEventOnce(`post_view:${post.id}`, payload)
      return
    }
    const node = cardRef.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      trackEventOnce(`post_view:${post.id}`, payload)
      return
    }
    const observer = new IntersectionObserver(entries => {
      const entry = entries[0]
      if (!entry?.isIntersecting || entry.intersectionRatio < 0.35) return
      trackEventOnce(`post_view:${post.id}`, payload)
      observer.disconnect()
    }, { threshold: [0.35, 0.55, 0.75] })
    observer.observe(node)
    return () => observer.disconnect()
  }, [authorId, currentUserId, expanded, post.id, post.type, postContent, postTitle])

  useEffect(() => {
    if (!attachedUrl || (spotifyMarkerEncoded && spotifyFromMarker?.previewUrl)) {
      setFetchedSpotify(null)
      return
    }

    const embed = getSpotifyEmbedUrl(attachedUrl)
    if (!embed?.includes('/track/')) {
      setFetchedSpotify(null)
      return
    }

    let cancelled = false
    fetch(`/api/spotify/track?url=${encodeURIComponent(attachedUrl)}`)
      .then(res => res.ok ? res.json() : Promise.reject(new Error('spotify track lookup failed')))
      .then((data: { track?: SpotifyTrackData | null }) => {
        if (!cancelled) setFetchedSpotify(data.track ?? null)
      })
      .catch(() => {
        if (!cancelled) setFetchedSpotify(null)
      })
    return () => { cancelled = true }
  }, [attachedUrl, spotifyMarkerEncoded, spotifyFromMarker?.previewUrl])

  const handleLike = async () => {
    const prev = liked; setLiked(!prev); setLikeCount(c => prev ? c - 1 : c + 1)
    try { await fetch(`/api/feed/posts/${post.id}/like`, { method: 'POST' }) }
    catch { setLiked(prev); setLikeCount(c => prev ? c + 1 : c - 1) }
  }

  const handleSave = async () => {
    const prev = saved; setSaved(!prev); setSaveCount(c => prev ? c - 1 : c + 1)
    try { await fetch(`/api/feed/posts/${post.id}/save`, { method: 'POST' }) }
    catch { setSaved(prev); setSaveCount(c => prev ? c + 1 : c - 1) }
  }

  const loadComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`)
      const d = await res.json()
      const rawComments: Comment[] = d.comments ?? []
      // Sync comment count to the real fetched count
      setCommentCount(rawComments.length)
      // Fetch Val likes for these comments
      if (rawComments.length > 0) {
        try {
          const ids = rawComments.map(c => c.id).join(',')
          const likesRes = await fetch(`/api/feed/comments/val-likes?ids=${ids}`)
          if (likesRes.ok) {
            const { userLikedIds } = await likesRes.json() as { userLikedIds: string[] }
            const userSet = new Set(userLikedIds)
            setComments(rawComments.map(c => ({ ...c, liked_by_me: userSet.has(c.id) })))
            return
          }
        } catch { /* fall through */ }
      }
      setComments(rawComments)
    } catch { /* silent */ }
  }, [post.id])

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) await loadComments()
    setShowComments(v => !v)
  }

  const submitComment = async () => {
    if (!newComment.trim() && !selectedCommentGif) return
    setSubmitting(true)
    const commentBody = appendGifMarker(newComment.trim(), selectedCommentGif)
    try {
      const res = await fetch(`/api/feed/posts/${post.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentBody,
          posted_as_organisation_id: feedIdentity?.type === 'org' ? feedIdentity.id : null,
        }),
      })
      if (res.ok) {
        void trackEvent({
          userId: authorId,
          eventType: 'post_comment',
          entityType: 'post',
          entityId: post.id,
          metadata: { title: postTitle ?? stripInternalMarkers(postContent)?.slice(0, 80) ?? null },
        })
        setNewComment(''); setSelectedCommentGif(null); setCommentCount(c => c + 1); await loadComments()
      }
    } catch { /* silent */ }
    finally { setSubmitting(false) }
  }

  useEffect(() => { if (expanded) loadComments() }, [expanded, loadComments])

  // Auto-focus comment textarea when comments panel opens
  useEffect(() => {
    if (showComments) {
      const timer = setTimeout(() => commentTextareaRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [showComments])

  // Close owner menu on outside click — defer listener to next tick so
  // the opening click doesn't immediately trigger it
  useEffect(() => {
    if (!showMenu) return
    const close = () => setShowMenu(false)
    const timer = setTimeout(() => {
      document.addEventListener('click', close)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', close)
    }
  }, [showMenu])

  const shareText = post.title ?? post.content ?? ''
  const hasReactionCounts = reactionCounts.total > 0

  const toggleShare = () => {
    setShowShare(prev => {
      const opening = !prev
      if (opening) {
        setShareCount(c => c + 1)
        void trackEvent({
          userId: authorId,
          eventType: 'post_share',
          entityType: 'post',
          entityId: post.id,
          metadata: { title: postTitle ?? stripInternalMarkers(postContent)?.slice(0, 80) ?? null },
        })
      }
      return opening
    })
  }

  // If deleted, vanish from feed instantly
  if (deleted) return null

  return (
    <article ref={cardRef} className={`ft-post-card${expanded ? ' ft-post-card--expanded' : ''}`} style={{ background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)', borderRadius: '14px', marginBottom: '12px', overflow: 'hidden', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 12px 10px 16px', minWidth: 0, overflow: 'visible', position: 'relative', zIndex: showMenu ? 200 : 2 }}>
        <Link href={authorLinkHref} style={{ flexShrink: 0, textDecoration: 'none' }}>
          <Avatar url={avatarUrl} name={name} size={42} />
        </Link>
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', minWidth: 0 }}>
            <Link href={authorLinkHref} style={{ fontWeight: 700, fontSize: '14px', color: 'var(--ft-text)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>{name}</Link>
            {!postedAsOrg && humanVerified && <InlineVerifiedBadge />}
            {postedAsOrg && (
              // Small chip marking this as an org byline so readers
              // can distinguish "a person posting" from "an org
              // posting". Keeps the accountability signal strong.
              <span style={{ fontSize: '10px', color: '#c4b5fd', background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Org</span>
            )}
            {trust !== null && trust > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--ft-accent)', background: 'rgba(56,189,248,0.12)', padding: '1px 7px', borderRadius: '20px', fontWeight: 600 }}>₮{Math.round(trust)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1px' }}>
            {/* Subtitle — for org posts, show "via @humanName" so the
                real author is still visible for accountability.
                For normal posts, show the author's @username. */}
            {postedAsOrg ? (
              humanId ? (
                <Link
                  href={`/profile?id=${humanId}`}
                  style={{ fontSize: '12px', color: 'var(--ft-text-tertiary)', textDecoration: 'none' }}
                >
                  via {humanName}{humanVerified ? ' ✓' : ''}
                </Link>
              ) : (
                <span style={{ fontSize: '12px', color: 'var(--ft-text-tertiary)' }}>via {humanName}{humanVerified ? ' ✓' : ''}</span>
              )
            ) : authorDisplayOverride?.subtitle ? (
              <span style={{ fontSize: '12px', color: 'var(--ft-text-faint)' }}>{authorDisplayOverride.subtitle}</span>
            ) : (
              !authorDisplayOverride?.hidePersonalByline && post.profiles?.username && <span style={{ fontSize: '12px', color: 'var(--ft-text-faint)' }}>@{post.profiles.username}</span>
            )}
            <span style={{ fontSize: '11px', color: 'var(--ft-border-strong)' }}>·</span>
            <span style={{ fontSize: '12px', color: 'var(--ft-text-faint)' }}>{formatTime(post.created_at)}</span>
            {postUpdatedAt && postUpdatedAt !== post.created_at && <span style={{ fontSize: '12px', color: 'var(--ft-text-tertiary)' }}>edited</span>}
          </div>
        </div>
        {/* Type badge */}
        {post.type !== 'text' && (
          <span style={{ padding: '3px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, color: typeInfo.color, background: typeInfo.bg, whiteSpace: 'nowrap', flexShrink: 0, position: 'relative', zIndex: 1 }}>
            {typeInfo.label}
          </span>
        )}
        {/* ── Owner menu ── */}
        {isOwner && (
          <div style={{ position: 'relative', flexShrink: 0, zIndex: 300 }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowMenu(v => !v)}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.18)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.08)')}
              style={{ background: 'rgba(148,163,184,0.08)', border: 'none', color: 'var(--ft-text-secondary)', fontSize: '20px', cursor: 'pointer', padding: '6px 10px', borderRadius: '8px', lineHeight: 1, minWidth: '32px', minHeight: '32px' }}
              aria-label="Post options"
            >⋯</button>
            {showMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)', borderRadius: '10px', overflow: 'hidden', zIndex: 10000, minWidth: '158px', boxShadow: '0 14px 34px rgba(0,0,0,0.55)' }}>
                {post.type !== 'poll' && (
                  <button
                    onClick={startEditing}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', color: 'var(--ft-accent)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <span>✏️</span>
                    <span>Edit post</span>
                  </button>
                )}
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '11px 14px', background: 'none', border: 'none', color: 'var(--ft-danger)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,113,113,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <span>🗑️</span>
                  <span>{deleting ? 'Deleting…' : 'Delete post'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '0 16px', minWidth: 0, overflow: 'hidden' }}>
        {editing ? (
          <div style={{ marginBottom: '12px' }}>
            {postTitle ? (
              <input
                value={editedTitle}
                onChange={e => setEditedTitle(e.target.value)}
                maxLength={200}
                style={{ width: '100%', background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', borderRadius: '10px', padding: '10px 12px', color: 'var(--ft-text)', fontSize: '16px', fontWeight: 700, fontFamily: 'inherit', marginBottom: '10px', boxSizing: 'border-box' }}
              />
            ) : null}
            <textarea
              value={editedContent}
              onChange={e => setEditedContent(e.target.value)}
              rows={8}
              maxLength={5000}
              style={{ width: '100%', background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', borderRadius: '10px', padding: '10px 12px', color: 'var(--ft-text-secondary)', fontSize: '14px', lineHeight: 1.65, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', marginBottom: '10px' }}
            />
            {post.type === 'photo' ? (
              <div style={{ border: '1px solid rgba(56,189,248,0.24)', borderRadius: 12, background: 'linear-gradient(135deg, rgba(56,189,248,0.08), rgba(15,23,42,0.96))', padding: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                  <div>
                    <div style={{ color: '#bae6fd', fontSize: 12, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }}>📷 Edit photos</div>
                    <div style={{ color: 'var(--ft-text-secondary)', fontSize: 12, marginTop: 3 }}>{editedPhotoUrls.length}/10 photos · first photo is the cover</div>
                  </div>
                  <label style={{ border: '1px solid rgba(56,189,248,0.42)', background: 'rgba(8,47,73,0.46)', color: '#bae6fd', borderRadius: 9, padding: '8px 10px', fontSize: 12, cursor: editPhotoUploading || editedPhotoUrls.length >= 10 ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 800, opacity: editPhotoUploading || editedPhotoUrls.length >= 10 ? 0.55 : 1, whiteSpace: 'nowrap' }}>
                    Add photos
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={editPhotoUploading || editedPhotoUrls.length >= 10}
                      onChange={e => { addEditedPhotos(e.target.files); e.currentTarget.value = '' }}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                {editedPhotoUrls.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 10 }}>
                    {editedPhotoUrls.map((url, index) => (
                      <div key={`${url}-${index}`} style={{ border: index === 0 ? '1px solid rgba(56,189,248,0.72)' : '1px solid var(--ft-border-strong)', borderRadius: 12, background: '#020617', overflow: 'hidden' }}>
                        <div style={{ position: 'relative', aspectRatio: '1 / 1', background: 'var(--ft-bg)' }}>
                          <img src={url} alt={`Photo ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          <span style={{ position: 'absolute', top: 7, left: 7, borderRadius: 999, padding: '3px 7px', background: index === 0 ? 'rgba(56,189,248,0.92)' : 'rgba(2,6,23,0.78)', color: index === 0 ? '#082f49' : '#e2e8f0', fontSize: 11, fontWeight: 900 }}>{index === 0 ? 'Cover' : index + 1}</span>
                        </div>
                        <div style={{ padding: 7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <button type="button" onClick={() => moveEditedPhoto(index, -1)} disabled={index === 0 || editPhotoUploading} style={{ border: '1px solid var(--ft-border-strong)', background: 'var(--ft-bg)', color: 'var(--ft-text-secondary)', borderRadius: 7, padding: '6px 4px', fontSize: 12, cursor: index === 0 || editPhotoUploading ? 'not-allowed' : 'pointer', opacity: index === 0 || editPhotoUploading ? 0.45 : 1 }}>↑</button>
                          <button type="button" onClick={() => moveEditedPhoto(index, 1)} disabled={index === editedPhotoUrls.length - 1 || editPhotoUploading} style={{ border: '1px solid var(--ft-border-strong)', background: 'var(--ft-bg)', color: 'var(--ft-text-secondary)', borderRadius: 7, padding: '6px 4px', fontSize: 12, cursor: index === editedPhotoUrls.length - 1 || editPhotoUploading ? 'not-allowed' : 'pointer', opacity: index === editedPhotoUrls.length - 1 || editPhotoUploading ? 0.45 : 1 }}>↓</button>
                          <label style={{ border: '1px solid rgba(56,189,248,0.35)', background: 'rgba(14,116,144,0.18)', color: '#bae6fd', borderRadius: 7, padding: '6px 4px', fontSize: 12, cursor: editPhotoUploading ? 'not-allowed' : 'pointer', textAlign: 'center', opacity: editPhotoUploading ? 0.5 : 1 }}>
                            Replace
                            <input
                              type="file"
                              accept="image/*"
                              disabled={editPhotoUploading}
                              onChange={e => { replaceEditedPhoto(index, e.target.files?.[0]); e.currentTarget.value = '' }}
                              style={{ display: 'none' }}
                            />
                          </label>
                          <button type="button" onClick={() => removeEditedPhoto(index)} disabled={editPhotoUploading} style={{ border: '1px solid rgba(248,113,113,0.42)', background: 'rgba(127,29,29,0.24)', color: '#fecaca', borderRadius: 7, padding: '6px 4px', fontSize: 12, cursor: editPhotoUploading ? 'not-allowed' : 'pointer', opacity: editPhotoUploading ? 0.5 : 1 }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ border: '1px dashed var(--ft-border-strong)', borderRadius: 10, padding: 12, color: 'var(--ft-text-secondary)', fontSize: 13, lineHeight: 1.45 }}>No photos selected. Add a photo, or save with no photo to remove media from this post.</div>
                )}
                {editPhotoProgress ? <div style={{ marginTop: 9, color: editPhotoProgress.startsWith('Upload failed') ? '#fca5a5' : '#93c5fd', fontSize: 12, lineHeight: 1.35 }}>{editPhotoProgress}</div> : null}
              </div>
            ) : null}
            {post.type === 'photo' ? (
              <div style={{ border: '1px solid rgba(30,215,96,0.28)', borderRadius: 12, background: 'linear-gradient(135deg, rgba(30,215,96,0.08), rgba(15,23,42,0.96))', padding: 12, marginBottom: 12 }}>
                <div style={{ color: '#bbf7d0', fontSize: 12, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>🎵 Edit music</div>
                <input
                  value={editSpotifyQuery}
                  onChange={e => searchEditSpotify(e.target.value)}
                  placeholder="Search Spotify tracks…"
                  style={{ width: '100%', background: '#020617', border: '1px solid var(--ft-border-strong)', borderRadius: 9, padding: '9px 10px', color: 'var(--ft-text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
                {!editSpotifyConfigured ? (
                  <div style={{ marginTop: 7, color: '#fbbf24', fontSize: 12, lineHeight: 1.35 }}>Spotify search is not configured. Paste a Spotify track URL below.</div>
                ) : null}
                {editSpotifyLoading ? <div style={{ marginTop: 7, color: 'var(--ft-text-secondary)', fontSize: 12 }}>Searching Spotify…</div> : null}
                {editSpotifyResults.length > 0 ? (
                  <div style={{ marginTop: 8, border: '1px solid var(--ft-border-strong)', borderRadius: 10, overflow: 'hidden', background: '#020617' }}>
                    {editSpotifyResults.slice(0, 6).map(track => (
                      <button
                        key={track.id ?? track.url}
                        type="button"
                        onClick={() => selectEditSpotifyTrack(track)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--ft-surface)', padding: '9px 10px', color: 'var(--ft-text)', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        {track.image ? <img src={track.image} alt="" style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 38, height: 38, borderRadius: 7, background: 'var(--ft-surface)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>♪</span>}
                        <span style={{ minWidth: 0 }}>
                          <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>{track.name}</strong>
                          {track.artists ? <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--ft-text-secondary)', fontSize: 12 }}>{track.artists}</span> : null}
                          <span style={{ display: 'block', color: track.previewUrl ? '#86efac' : '#fbbf24', fontSize: 11, marginTop: 2 }}>{track.previewUrl ? (track.previewSource === 'itunes' ? 'Apple preview available' : 'Preview available') : 'Preview unavailable'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
                {(editedSpotifyTrack?.name || editedSpotifyUrl) ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(2,6,23,0.72)', border: '1px solid rgba(148,163,184,0.18)' }}>
                    {editedSpotifyTrack?.image ? <img src={editedSpotifyTrack.image} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(30,215,96,0.14)', color: '#86efac', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>♪</span>}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#f8fafc', fontSize: 13, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editedSpotifyTrack?.name ?? 'Spotify track URL'}</div>
                      {editedSpotifyTrack?.artists ? <div style={{ color: '#86efac', fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editedSpotifyTrack.artists}</div> : null}
                      {editedSpotifyTrack?.name ? <div style={{ color: editedSpotifyTrack.previewUrl ? '#86efac' : '#fbbf24', fontSize: 11, marginTop: 2 }}>{editedSpotifyTrack.previewUrl ? (editedSpotifyTrack.previewSource === 'itunes' ? 'Speaker will play Apple preview' : 'Speaker will play preview') : 'Preview unavailable — song title only'}</div> : null}
                    </div>
                    <button
                      type="button"
                      onClick={clearEditedSpotify}
                      style={{ border: '1px solid rgba(248,113,113,0.42)', background: 'rgba(127,29,29,0.24)', color: '#fecaca', borderRadius: 8, padding: '7px 9px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 800 }}
                    >Remove</button>
                  </div>
                ) : null}
                <input
                  value={editedSpotifyUrl}
                  onChange={e => { setEditedSpotifyUrl(e.target.value); setEditedSpotifyTrack(null) }}
                  placeholder="Or paste Spotify track URL…"
                  style={{ width: '100%', marginTop: 10, background: '#020617', border: '1px solid var(--ft-border-strong)', borderRadius: 9, padding: '9px 10px', color: 'var(--ft-text)', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
                />
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={cancelEditing}
                disabled={savingEdit || editPhotoUploading}
                style={{ background: 'transparent', border: '1px solid var(--ft-border-strong)', borderRadius: '8px', padding: '8px 12px', color: 'var(--ft-text-secondary)', cursor: savingEdit || editPhotoUploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', opacity: savingEdit || editPhotoUploading ? 0.6 : 1 }}
              >Cancel</button>
              <button
                onClick={handleSaveEdit}
                disabled={savingEdit || editPhotoUploading}
                style={{ background: 'var(--ft-accent)', border: 'none', borderRadius: '8px', padding: '8px 12px', color: 'var(--ft-bg)', cursor: savingEdit || editPhotoUploading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, opacity: savingEdit || editPhotoUploading ? 0.72 : 1 }}
              >{editPhotoUploading ? 'Uploading…' : savingEdit ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        ) : (
          <>
            {postTitle ? (
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ft-text)', margin: '0 0 8px', lineHeight: 1.4, wordBreak: 'break-word' }}>{String(postTitle)}</h3>
            ) : null}
            {/* For polls, content is stored as JSON — don't render it as body text;
                the poll UI block below handles rendering. */}
            {displayContent && post.type !== 'poll' ? (
              <p style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--ft-text-secondary)', margin: '0 0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                <ContentWithLinks text={displayContent} expanded={expanded} canonicalUrl={canonicalUrl} />
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* Link preview. Render immediately after the content so service cards show
          their destination before the image/media. Photo Spotify tracks are shown
          as the rotated overlay in the carousel; rendering the full iframe above
          the media looks like a random box on mobile and duplicates the song. */}
      {attachedUrl && post.type !== 'service' && post.type !== 'music' && !isPhotoSpotifyAttachment ? <LinkPreviewCard url={attachedUrl} /> : null}

      {/* ── Media ── */}
      {post.type === 'music' ? (
        <div className="ft-post-media-wrap" style={{ padding: '0 16px' }}>
          <MusicPlayer postId={post.id} src={mediaUrls[0] ?? spotifyTrack?.previewUrl ?? null} track={spotifyTrack} title={postTitle} />
        </div>
      ) : isVideo && mediaUrls.length > 0 ? (
        <div className="ft-post-media-wrap" style={{ padding: '0 16px' }}>
          <VideoPlayer src={mediaUrls[0]} isShort={isShort} textOverlay={textOverlay} />
        </div>
      ) : mediaUrls.length > 0 ? (
        <div className="ft-post-media-wrap" style={{ padding: '0 16px' }}>
          <PhotoCarousel urls={mediaUrls} alt={name} soundtrack={post.type === 'photo' ? spotifyTrack : null} textOverlay={textOverlay} imageHref={post.type === 'service' ? canonicalUrl : null} imageBadge={post.type === 'service' ? { label: 'Service', href: canonicalUrl, ariaLabel: `Open ${name} service page` } : null} />
        </div>
      ) : null}

      {/* ── Poll ── */}
      {post.type === 'poll' && (() => {
        let pollData: { question?: string; options?: string[]; duration?: string } = {}
        try { pollData = JSON.parse(post.content ?? '{}') } catch { pollData = {} }
        const options = pollData.options ?? []
        const totalVotes = Object.values(localVoteCounts).reduce((a: number, b: number) => a + b, 0)

        // Expiry calculation
        const durationMap: Record<string, number> = { '1d': 86400000, '3d': 259200000, '7d': 604800000, '14d': 1209600000 }
        const durationMs = durationMap[pollData.duration ?? '7d'] ?? 604800000
        const createdAt = new Date(post.created_at).getTime()
        const expiresAt = createdAt + durationMs
        const isPollExpired = Date.now() > expiresAt
        const timeRemaining = (() => {
          if (isPollExpired) return 'Ended'
          const ms = expiresAt - Date.now()
          const hours = Math.floor(ms / 3600000)
          const days = Math.floor(hours / 24)
          if (days > 0) return `${days}d left`
          if (hours > 0) return `${hours}h left`
          return 'Ending soon'
        })()

        // Show results if user has voted OR poll has expired
        const hasVoted = localUserVote !== null || isPollExpired

        const handleVote = async (idx: number) => {
          if (isPollExpired) return
          // Optimistic update
          const prevVote = localUserVote
          const prevCounts = { ...localVoteCounts }
          const newCounts = { ...localVoteCounts }

          if (prevVote === idx) {
            // Toggle off
            setLocalUserVote(null)
            newCounts[idx] = Math.max(0, (newCounts[idx] ?? 0) - 1)
            if (newCounts[idx] === 0) delete newCounts[idx]
          } else {
            if (prevVote !== null) {
              // Remove old vote
              newCounts[prevVote] = Math.max(0, (newCounts[prevVote] ?? 0) - 1)
              if (newCounts[prevVote] === 0) delete newCounts[prevVote]
            }
            setLocalUserVote(idx)
            newCounts[idx] = (newCounts[idx] ?? 0) + 1
          }
          setLocalVoteCounts(newCounts)

          try {
            const res = await fetch(`/api/feed/posts/${post.id}/vote`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ optionIdx: idx }),
            })
            if (res.ok) {
              const data = await res.json() as { user_vote: number | null; counts: Record<number, number>; total: number }
              setLocalUserVote(data.user_vote)
              setLocalVoteCounts(data.counts ?? {})
            } else {
              const errData = await res.json().catch(() => ({})) as { expired?: boolean }
              if (errData.expired) {
                // Poll ended between load and vote — don't revert, just leave results visible
                console.warn('[poll] vote rejected: poll has ended')
              } else {
                // Revert on other errors
                setLocalUserVote(prevVote)
                setLocalVoteCounts(prevCounts)
              }
            }
          } catch {
            setLocalUserVote(prevVote)
            setLocalVoteCounts(prevCounts)
          }
        }

        return (
          <div style={{ margin: '0 16px 14px' }}>
            {options.map((opt, i) => {
              const votes = localVoteCounts[i] ?? 0
              const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0
              const isChosen = localUserVote === i
              return (
                <button
                  key={i}
                  disabled={isPollExpired}
                  onClick={() => handleVote(i)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    position: 'relative', overflow: 'hidden',
                    background: isChosen ? 'rgba(56,189,248,0.1)' : 'rgba(15,23,42,0.6)',
                    border: isChosen ? '1px solid rgba(56,189,248,0.5)' : '1px solid var(--ft-border-strong)',
                    borderRadius: '10px', padding: '10px 14px', marginBottom: '8px',
                    cursor: isPollExpired ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'border-color 0.15s',
                    opacity: isPollExpired && !isChosen ? 0.7 : 1,
                  }}
                >
                  {/* Progress bar fill — shown after voting or when expired */}
                  {hasVoted && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: `${pct}%`,
                      background: isChosen ? 'rgba(56,189,248,0.15)' : 'rgba(148,163,184,0.07)',
                      transition: 'width 0.4s ease',
                      borderRadius: '10px',
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '13px',
                      color: isChosen ? 'var(--ft-accent)' : 'var(--ft-text-secondary)',
                      fontWeight: isChosen ? 600 : 400,
                      lineHeight: 1.4,
                    }}>
                      {isChosen && <span style={{ marginRight: '4px' }}>✓</span>}{opt}
                    </span>
                    {hasVoted && (
                      <span style={{ fontSize: '12px', color: 'var(--ft-text-tertiary)', flexShrink: 0, fontWeight: 500 }}>
                        {pct}%
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            <div style={{ fontSize: '11px', marginTop: '2px', display: 'flex', gap: '8px' }}>
              <span style={{ color: 'var(--ft-text-tertiary)' }}>{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
              <span style={{ color: isPollExpired ? '#fbbf24' : 'var(--ft-text-tertiary)' }}>
                {isPollExpired ? '🔒 Poll ended' : `⏱ ${timeRemaining}`}
              </span>
            </div>
          </div>
        )
      })()}

      {/* ── Top comment preview (inline) ── */}
      {post.top_comment && !showComments && (
        <Link
          href={canonicalUrl}
          style={{ display: 'block', margin: '8px 16px 0', padding: '8px 12px', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(51,65,85,0.6)', borderRadius: 10, textDecoration: 'none' }}
        >
          <div style={{ fontSize: 11, color: 'var(--ft-text-tertiary)', fontWeight: 600, marginBottom: 2 }}>
            {post.top_comment.author_name ?? 'A member'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--ft-text-secondary)', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {post.top_comment.content}
          </div>
        </Link>
      )}

      {/* ── Compact per-type reaction counts ── */}
      {hasReactionCounts && (
        <div
          aria-label="Reaction counts by type"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '7px 12px 0',
            minWidth: 0,
            overflowX: 'auto',
            scrollbarWidth: 'none',
          }}
        >
          {REACTIONS.map(r => {
            const count = reactionCounts[r.type] ?? 0
            const isActive = userReaction === r.type
            return (
              <button
                key={r.type}
                type="button"
                onClick={(e) => { e.stopPropagation(); handleReact(r.type) }}
                title={`${r.label}: ${count}`}
                aria-label={`${r.label}: ${count}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  minHeight: 24,
                  padding: '3px 7px',
                  borderRadius: 999,
                  border: isActive ? `1px solid ${r.color}88` : '1px solid rgba(51,65,85,0.86)',
                  background: isActive ? `${r.color}1f` : 'rgba(15,23,42,0.52)',
                  color: count > 0 || isActive ? 'var(--ft-text-secondary)' : 'var(--ft-text-faint)',
                  opacity: count > 0 || isActive ? 1 : 0.55,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1 }}>{r.emoji}</span>
                <span style={{ fontSize: 11, lineHeight: 1, fontWeight: isActive ? 900 : 700, color: count > 0 || isActive ? '#e2e8f0' : 'var(--ft-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: hasReactionCounts ? '7px 8px 10px' : '10px 8px 10px', borderTop: '1px solid rgba(51,65,85,0.6)', marginTop: hasReactionCounts ? '7px' : '10px', width: '100%', boxSizing: 'border-box' }}>
        {/* React button + picker */}
        <div ref={reactBtnWrapRef} style={{ position: 'relative' }}>
          <ActionBtn
            icon={userReaction
              ? (REACTIONS.find(r => r.type === userReaction)?.emoji ?? '👍')
              : '👍'}
            label={reactionTotal > 0
              ? reactionTotal.toString()
              : (userReaction ? (REACTIONS.find(r => r.type === userReaction)?.label ?? 'React') : 'React')}
            active={!!userReaction}
            onClick={(e) => {
              e?.stopPropagation()
              if (!showReactionPicker && reactBtnWrapRef.current) {
                const rect = reactBtnWrapRef.current.getBoundingClientRect()
                setPickerPos({ top: rect.top - 52, left: rect.left })
              }
              setShowReactionPicker(v => !v)
            }}
          />
          {showReactionPicker && pickerPos && (
            <div
              ref={reactionPickerRef}
              style={{ position: 'fixed', top: pickerPos.top, left: pickerPos.left, marginBottom: 6, background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', borderRadius: 999, padding: '6px 8px', display: 'flex', gap: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 9999 }}>
              {REACTIONS.map(r => {
                const isActive = userReaction === r.type
                const count = reactionCounts[r.type] ?? 0
                return (
                  <button
                    key={r.type}
                    onClick={(e) => { e.stopPropagation(); handleReact(r.type) }}
                    title={`${r.label}: ${count}`}
                    aria-label={`${r.label}: ${count}`}
                    style={{
                      background: isActive ? `${r.color}22` : 'transparent',
                      border: isActive ? `1px solid ${r.color}66` : '1px solid transparent',
                      borderRadius: 14, minWidth: 38, minHeight: 38, fontSize: 18, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                      transition: 'transform 0.12s',
                      fontFamily: 'inherit',
                      color: '#e2e8f0',
                      padding: '3px 5px',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.25)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                  >
                    <span style={{ lineHeight: 1 }}>{r.emoji}</span>
                    <span style={{ fontSize: 9, lineHeight: 1, fontWeight: 900, color: count > 0 || isActive ? r.color : 'var(--ft-text-faint)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <ActionBtn
          icon="💬"
          label={commentCount > 0 ? `${commentCount}` : 'Comment'}
          active={showComments}
          onClick={toggleComments}
        />
        <ActionBtn
          icon="📤"
          label={shareCount > 0 ? shareCount.toString() : 'Share'}
          active={showShare}
          onClick={toggleShare}
        />
        <ActionBtn
          icon={saved ? '🔖' : '🏷️'}
          label={saveCount > 0 ? saveCount.toString() : 'Save'}
          active={saved}
          onClick={handleSave}
        />
        <div style={{ flex: 1 }} />
        {currentUserId ? <div ref={identityPickerRef} style={{ position: 'relative', flexShrink: 0 }}>
          <style>{`
            @media (max-width: 640px) {
              .ft-feed-identity-menu {
                position: fixed !important;
                left: 12px !important;
                right: 12px !important;
                bottom: calc(env(safe-area-inset-bottom, 0px) + 88px) !important;
                width: auto !important;
                max-width: calc(100vw - 24px) !important;
                max-height: min(62vh, 520px) !important;
                box-sizing: border-box !important;
                overflow-x: hidden !important;
              }
            }
          `}</style>
          {identityOpen && (
            <div
              className="ft-feed-identity-menu"
              style={{
                position: 'absolute',
                right: 0,
                bottom: 40,
                width: 'min(270px, 84vw)',
                maxHeight: '50vh',
                overflowY: 'auto',
                borderRadius: 16,
                border: '1px solid rgba(96,165,250,0.28)',
                background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(2,6,23,0.98))',
                boxShadow: '0 18px 50px rgba(0,0,0,0.55), 0 0 24px rgba(56,189,248,0.12)',
                padding: 8,
                zIndex: 10000,
              }}
              aria-label="Choose reaction and comment identity"
            >
              <div style={{ color: 'var(--ft-text-secondary)', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '7px 8px 8px' }}>
                React/comment as
              </div>
              {(displayedIdentityOptions.personal ?? (feedIdentity?.type === 'personal' ? feedIdentity : null)) ? (
                <button
                  type="button"
                  onClick={() => chooseFeedIdentity(displayedIdentityOptions.personal ?? feedIdentity as Extract<FeedIdentity, { type: 'personal' }>)}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    border: feedIdentity?.type === 'personal' ? '1px solid rgba(56,189,248,0.42)' : '1px solid transparent',
                    background: feedIdentity?.type === 'personal' ? 'rgba(56,189,248,0.12)' : 'transparent',
                    color: '#f8fafc',
                    borderRadius: 12,
                    padding: '8px 9px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <Avatar url={(displayedIdentityOptions.personal ?? feedIdentity as Extract<FeedIdentity, { type: 'personal' }>).avatar_url} name={(displayedIdentityOptions.personal ?? feedIdentity as Extract<FeedIdentity, { type: 'personal' }>).name} size={34} />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(displayedIdentityOptions.personal ?? feedIdentity as Extract<FeedIdentity, { type: 'personal' }>).name}</span>
                    <span style={{ display: 'block', color: 'var(--ft-text-secondary)', fontSize: 11 }}>Personal profile</span>
                  </span>
                  {feedIdentity?.type === 'personal' ? <span style={{ color: 'var(--ft-accent)', fontSize: 14 }}>✓</span> : null}
                </button>
              ) : null}
              {displayedIdentityOptions.pages.length > 0 || identityLoading ? <div style={{ height: 1, background: 'rgba(51,65,85,0.8)', margin: '6px 4px' }} /> : null}
              {identityLoading && displayedIdentityOptions.pages.length === 0 ? <div style={{ color: 'var(--ft-text-secondary)', fontSize: 12, padding: '9px 10px' }}>Loading your pages…</div> : null}
              {!identityLoading && displayedIdentityOptions.pages.length === 0 ? <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 12, padding: '9px 10px' }}>No admin pages found.</div> : null}
              {identityLoading && displayedIdentityOptions.pages.length > 0 ? <div style={{ color: 'var(--ft-text-tertiary)', fontSize: 11, padding: '3px 10px 7px' }}>Refreshing page list…</div> : null}
              {displayedIdentityOptions.pages.map(page => {
                const selected = feedIdentity?.type === 'org' && feedIdentity.id === page.id
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => chooseFeedIdentity(page)}
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
                      <span style={{ display: 'block', color: '#86efac', fontSize: 11 }}>{page.userRole === 'admin' ? 'Admin page' : page.userRole === 'owner' ? 'Owner page' : 'Selected page'}</span>
                    </span>
                    {selected ? <span style={{ color: '#22c55e', fontSize: 14 }}>✓</span> : null}
                  </button>
                )
              })}
            </div>
          )}
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); setIdentityOpen(v => !v) }}
            aria-label="Choose reaction and comment identity"
            title={`React/comment as ${feedIdentity?.name ?? 'profile or page'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 4px 4px 8px',
              border: 'none',
              background: 'transparent',
              color: feedIdentity?.type === 'org' ? '#86efac' : 'var(--ft-text-secondary)',
              fontSize: 11,
              fontWeight: 700,
              minWidth: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {feedIdentity?.type === 'org' ? <span style={{ maxWidth: 82, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>as {feedIdentity.name}</span> : null}
            <span style={{ position: 'relative', width: 28, height: 28, display: 'inline-flex' }}>
              <Avatar
                url={feedIdentity?.type === 'org' ? feedIdentity.logo_url : feedIdentity?.type === 'personal' ? feedIdentity.avatar_url : humanAvatar}
                name={feedIdentity?.name ?? humanName}
                size={28}
              />
              <span style={{ position: 'absolute', right: -5, bottom: -3, width: 13, height: 13, borderRadius: '50%', background: 'var(--ft-bg)', border: '1px solid var(--ft-border-strong)', color: 'var(--ft-accent)', fontSize: 9, lineHeight: '11px', fontWeight: 900 }}>⌄</span>
            </span>
          </button>
        </div> : null}
      </div>

      {/* ── Share sheet ── */}
      {showShare && (
        <div style={{ padding: '0 16px 14px' }}>
          <ShareSheet postId={post.id} canonicalPath={canonicalUrl} text={shareText} onClose={() => setShowShare(false)} />
        </div>
      )}

      {/* ── Comments ── */}
      {showComments && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--ft-surface)' }}>
          <div style={{ paddingTop: '12px' }}>
            {comments.length === 0 && (
              <p style={{ fontSize: '13px', color: 'var(--ft-text-tertiary)', margin: '0 0 10px' }}>No comments yet — be first!</p>
            )}
            {comments.map(c => (
              <CommentRow
                key={c.id}
                comment={c}
                onLikeToggle={(commentId, liked, delta) => {
                  setComments(prev => prev.map(x =>
                    x.id === commentId
                      ? { ...x, liked_by_me: liked, like_count: Math.max(0, (x.like_count ?? 0) + delta) }
                      : x
                  ))
                }}
              />
            ))}
            {/* Comment composer */}
            <div style={{ marginTop: '8px' }}>
              {feedIdentity ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 8, padding: '5px 9px', borderRadius: 999, border: '1px solid rgba(56,189,248,0.18)', background: 'rgba(15,23,42,0.45)', color: feedIdentity.type === 'org' ? '#86efac' : 'var(--ft-text-secondary)', fontSize: 11, fontWeight: 700 }}>
                  <Avatar url={feedIdentity.type === 'org' ? feedIdentity.logo_url : feedIdentity.avatar_url} name={feedIdentity.name} size={20} />
                  <span>Commenting as {feedIdentity.name}</span>
                </div>
              ) : null}
              {/* Textarea wrapper */}
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={commentTextareaRef}
                  style={{
                    width: '100%',
                    minHeight: commentExpanded ? '220px' : '60px',
                    maxHeight: commentExpanded ? '220px' : '150px',
                    background: 'rgba(56,189,248,0.05)',
                    border: '1px solid rgba(56,189,248,0.15)',
                    borderRadius: '12px',
                    padding: '10px 40px 10px 12px',
                    color: 'var(--ft-text)',
                    fontSize: '13px',
                    outline: 'none',
                    fontFamily: 'inherit',
                    resize: 'none',
                    overflowY: commentExpanded ? 'auto' : 'hidden',
                    lineHeight: '1.5',
                    boxSizing: 'border-box',
                    display: 'block',
                    transition: 'min-height 0.15s, max-height 0.15s',
                  }}
                  placeholder="Write a comment…"
                  value={newComment}
                  maxLength={500}
                  rows={2}
                  onChange={e => {
                    setNewComment(e.target.value)
                    if (!commentExpanded) {
                      const el = e.target
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 150) + 'px'
                    }
                  }}
                  onKeyDown={() => { /* Enter adds newline naturally; no submit on Enter */ }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.4)' }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'rgba(56,189,248,0.15)' }}
                />
                {/* Expand/collapse toggle */}
                <button
                  type="button"
                  onClick={() => setCommentExpanded(v => !v)}
                  title={commentExpanded ? 'Collapse' : 'Expand for more space'}
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    background: 'rgba(56,189,248,0.12)',
                    border: 'none',
                    borderRadius: '6px',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: 'var(--ft-accent)',
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  {commentExpanded ? '▲' : '▼'}
                </button>
              </div>

              {selectedCommentGif && (
                <div style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 14, border: '1px solid rgba(52,211,153,0.24)', background: 'rgba(15,23,42,0.72)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedCommentGif.previewUrl} alt={selectedCommentGif.title} style={{ width: 96, height: 72, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                  <span style={{ maxWidth: 160, color: 'var(--ft-text-secondary)', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedCommentGif.title || 'GIF'}</span>
                </div>
              )}

              {/* Character counter + Post button row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GifPicker selectedGif={selectedCommentGif} onSelect={setSelectedCommentGif} disabled={submitting} compact />
                  <span style={{
                    fontSize: '11px',
                    color: newComment.length > 450 ? 'var(--ft-danger)' : 'var(--ft-text-faint)',
                    opacity: newComment.length > 0 ? 1 : 0,
                    transition: 'opacity 0.15s',
                  }}>
                    {newComment.length} / 500
                  </span>
                </div>
                <button
                  onClick={submitComment}
                  disabled={submitting || (!newComment.trim() && !selectedCommentGif)}
                  style={{
                    background: 'var(--ft-accent)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: 'var(--ft-bg)',
                    cursor: submitting || (!newComment.trim() && !selectedCommentGif) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    opacity: (submitting || (!newComment.trim() && !selectedCommentGif)) ? 0.5 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  {submitting ? '…' : 'Post'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  )
}

// ── Comment Row ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  onLikeToggle,
}: {
  comment: Comment
  onLikeToggle: (id: string, liked: boolean, delta: number) => void
}) {
  const [liking, setLiking] = useState(false)
  const org = comment.posted_as_organisation ?? null
  const cName = org?.name ?? comment.profiles?.full_name ?? comment.profiles?.username ?? 'FreeTrust Member'

  const handleLike = async () => {
    if (liking) return
    setLiking(true)
    const wasLiked = comment.liked_by_me ?? false
    onLikeToggle(comment.id, !wasLiked, wasLiked ? -1 : 1)
    try {
      await fetch(`/api/feed/comments/${comment.id}/like`, { method: 'POST' })
    } catch {
      // revert on error
      onLikeToggle(comment.id, wasLiked, wasLiked ? 1 : -1)
    } finally {
      setLiking(false)
    }
  }

  const likeCount = comment.like_count ?? 0
  const liked = comment.liked_by_me ?? false

  const profileHref = org
    ? `/organisations/${encodeURIComponent(org.slug || org.id)}`
    : comment.profiles?.id ? `/profile?id=${comment.profiles.id}` : null
  const avatarUrl = org?.logo_url ?? comment.profiles?.avatar_url ?? null

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'flex-start' }}>
      {profileHref ? (
        <Link href={profileHref} style={{ flexShrink: 0, textDecoration: 'none' }}>
          <Avatar url={avatarUrl} name={cName} size={30} />
        </Link>
      ) : (
        <Avatar url={avatarUrl} name={cName} size={30} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: '10px', padding: '8px 12px' }}>
          {profileHref ? (
            <Link href={profileHref} style={{ fontSize: '12px', fontWeight: 600, color: org ? '#86efac' : 'var(--ft-text-secondary)', marginBottom: '2px', display: 'block', textDecoration: 'none' }}>{cName}{org ? <span style={{ marginLeft: 6, color: '#c4b5fd', fontSize: 10, textTransform: 'uppercase' }}>Page</span> : null}</Link>
          ) : (
            <div style={{ fontSize: '12px', fontWeight: 600, color: org ? '#86efac' : 'var(--ft-text-secondary)', marginBottom: '2px' }}>{cName}{org ? <span style={{ marginLeft: 6, color: '#c4b5fd', fontSize: 10, textTransform: 'uppercase' }}>Page</span> : null}</div>
          )}
          <div style={{ fontSize: '13px', color: 'var(--ft-text-secondary)', lineHeight: 1.5, wordBreak: 'break-word' }}>
            <GifContent content={comment.content} gifStyle={{ width: 'min(100%, 220px)', maxHeight: 220 }} />
          </div>
        </div>
        {/* Like row + Val badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', marginLeft: '4px' }}>
          <button
            onClick={handleLike}
            disabled={liking}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '3px',
              background: liked ? 'rgba(248,113,113,0.12)' : 'transparent',
              border: liked ? '1px solid rgba(248,113,113,0.25)' : '1px solid transparent',
              borderRadius: '20px', padding: '2px 8px',
              fontSize: '11px', fontWeight: 600,
              color: liked ? 'var(--ft-danger)' : 'var(--ft-text-tertiary)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!liked) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ft-danger)' }}
            onMouseLeave={e => { if (!liked) (e.currentTarget as HTMLButtonElement).style.color = 'var(--ft-text-tertiary)' }}
          >
            <span style={{ fontSize: '12px' }}>{liked ? '❤️' : '🤍'}</span>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>

        </div>
      </div>
    </div>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: (e?: ReactMouseEvent) => void }) {
  return (
    <>
      <style>{`
        .action-btn-label { display: inline; }
        @media (max-width: 380px) { .action-btn-label { display: none !important; } }
      `}</style>
      <button
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: '3px', padding: '6px 8px',
          background: active ? 'rgba(56,189,248,0.1)' : 'none',
          border: 'none', borderRadius: '8px', cursor: 'pointer',
          fontSize: '13px', color: active ? 'var(--ft-accent)' : 'var(--ft-text-tertiary)',
          fontFamily: 'inherit', transition: 'all 0.15s', fontWeight: active ? 600 : 400,
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--ft-accent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = active ? 'var(--ft-accent)' : 'var(--ft-text-tertiary)' }}
      >
        <span style={{ fontSize: '15px', lineHeight: 1 }}>{icon}</span>
        <span className="action-btn-label">{label}</span>
      </button>
    </>
  )
}
