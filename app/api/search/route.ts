export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { REAL_EVENT_SOURCE_FILTER, REAL_JOB_SOURCE_FILTER } from '@/lib/dataIntegrity'

type HitType = 'member' | 'post' | 'service' | 'product' | 'job' | 'event' | 'article' | 'org' | 'grassroots'
type ThumbnailKind = 'image' | 'video'

interface SearchHit {
  id: string
  type: HitType
  title: string
  subtitle?: string
  snippet?: string
  url: string
  avatarUrl?: string | null
  authorName?: string | null
  authorAvatarUrl?: string | null
  createdAt?: string | null
  thumbnailUrl?: string | null
  thumbnailKind?: ThumbnailKind
}

const TYPE_META: Record<HitType, { label: string; emoji: string; from: string; to: string }> = {
  member: { label: 'Member', emoji: '👤', from: '#38bdf8', to: '#818cf8' },
  post: { label: 'Post', emoji: '📰', from: '#22c55e', to: '#38bdf8' },
  service: { label: 'Service', emoji: '🛠️', from: '#14b8a6', to: '#22c55e' },
  product: { label: 'Product', emoji: '📦', from: '#f97316', to: '#f59e0b' },
  job: { label: 'Job', emoji: '💼', from: '#60a5fa', to: '#a78bfa' },
  event: { label: 'Event', emoji: '📅', from: '#f472b6', to: '#fb7185' },
  article: { label: 'Article', emoji: '✍️', from: '#a78bfa', to: '#38bdf8' },
  org: { label: 'Organisation', emoji: '🏢', from: '#34d399', to: '#06b6d4' },
  grassroots: { label: 'Grassroots', emoji: '🌱', from: '#84cc16', to: '#22c55e' },
}

function firstText(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function cleanSnippet(value: unknown, max = 260): string | undefined {
  const raw = firstText(value)
  if (!raw) return undefined
  const cleaned = raw
    .replace(/\[\[FT_[A-Z_]+:[^\]]*\]\]/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return undefined
  return cleaned.length > max ? `${cleaned.slice(0, max).trim()}…` : cleaned
}

function isImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function firstImage(...values: unknown[]): string | null {
  for (const value of values) {
    if (isImageUrl(value)) return value
    if (Array.isArray(value)) {
      const found = value.find(isImageUrl)
      if (found) return found
    }
  }
  return null
}

function fallbackThumbnail(type: HitType, title: string): string {
  const meta = TYPE_META[type]
  const safeTitle = title.replace(/[<>&]/g, '').slice(0, 48)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${meta.from}"/><stop offset="1" stop-color="${meta.to}"/></linearGradient><radialGradient id="r" cx="78%" cy="18%" r="72%"><stop stop-color="rgba(255,255,255,.34)"/><stop offset="1" stop-color="rgba(255,255,255,0)"/></radialGradient></defs><rect width="1200" height="760" fill="#0f172a"/><rect width="1200" height="760" fill="url(#g)" opacity=".64"/><rect width="1200" height="760" fill="url(#r)"/><circle cx="1020" cy="130" r="160" fill="rgba(255,255,255,.13)"/><circle cx="160" cy="650" r="230" fill="rgba(15,23,42,.24)"/><text x="92" y="194" font-size="108" font-family="Arial, Helvetica, sans-serif">${meta.emoji}</text><text x="92" y="535" fill="#f8fafc" font-size="76" font-weight="800" font-family="Arial, Helvetica, sans-serif">${safeTitle}</text><text x="96" y="612" fill="#d1fae5" font-size="34" font-weight="800" letter-spacing="7" font-family="Arial, Helvetica, sans-serif">FREETRUST ${meta.label.toUpperCase()}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function displayDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return null }
}

function matchesText(row: Record<string, unknown>, q: string, fields: string[]): boolean {
  if (!q) return true
  const needle = q.toLowerCase()
  return fields.some((field) => String(row[field] ?? '').toLowerCase().includes(needle))
}

function searchOr(fields: string[], q: string): string {
  const safe = q.replace(/[%,]/g, ' ').trim()
  return fields.map((field) => `${field}.ilike.%${safe}%`).join(',')
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim()
    const filter = (searchParams.get('filter') ?? 'all').toLowerCase()
    const scope = (searchParams.get('scope') ?? 'discover').toLowerCase()
    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10)
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitParam) ? limitParam : 20))
    const perType = Math.max(4, Math.ceil(limit / 4))

    if (!q) {
      return NextResponse.json({ hits: [], total: 0, query: q, filter, scope }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (scope === 'following' && !user) {
      return NextResponse.json({ hits: [], total: 0, query: q, filter, scope, message: 'sign_in_required' }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const hits: SearchHit[] = []
    const include = (type: HitType) => {
      if (filter === 'all' || filter === 'discover') return true
      if (filter === 'photos' || filter === 'videos' || filter === 'trending') return type === 'post'
      if (filter === 'articles') return type === 'article'
      if (filter === 'services') return type === 'service'
      if (filter === 'jobs') return type === 'job'
      if (filter === 'events') return type === 'event'
      return true
    }

    const profileIds = new Set<string>()
    const profileById = new Map<string, { full_name?: string | null; avatar_url?: string | null; location?: string | null }>()
    if (include('member') || include('post')) {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, location, avatar_url')
        .is('deleted_at', null)
        .or(searchOr(['full_name', 'location', 'bio'], q))
        .limit(filter === 'all' ? perType : limit)
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        const id = String(row.id)
        profileIds.add(id)
        profileById.set(id, row as any)
        if (include('member')) {
          const title = firstText(row.full_name) ?? 'Member'
          hits.push({
            id,
            type: 'member',
            title,
            subtitle: firstText(row.location) ?? undefined,
            snippet: firstText(row.location) ?? undefined,
            url: `/profile?id=${id}`,
            avatarUrl: firstText(row.avatar_url),
            authorName: title,
            authorAvatarUrl: firstText(row.avatar_url),
            createdAt: null,
            thumbnailUrl: firstImage(row.avatar_url) ?? fallbackThumbnail('member', title),
            thumbnailKind: 'image',
          })
        }
      }
    }

    if (include('post')) {
      let postQuery = supabase
        .from('feed_posts')
        .select('id, user_id, type, title, content, media_url, media_type, link_url, created_at, likes_count, comments_count, profiles!feed_posts_user_id_fkey(id, full_name, avatar_url)')
        .lte('created_at', new Date().toISOString())
        .order(filter === 'trending' ? 'likes_count' : 'created_at', { ascending: false })
        .limit(filter === 'all' ? perType * 3 : limit * 2)
      if (filter === 'photos') postQuery = postQuery.or('type.eq.photo,media_type.eq.image')
      else if (filter === 'videos') postQuery = postQuery.or('type.eq.video,type.eq.short,media_type.eq.video')
      const { data } = await postQuery
      for (const row of ((data ?? []) as any[])) {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        const authorName = firstText(profile?.full_name) ?? 'FreeTrust member'
        const matchesAuthor = String(authorName).toLowerCase().includes(q.toLowerCase()) || profileIds.has(String(row.user_id))
        if (!matchesAuthor && !matchesText(row, q, ['title', 'content'])) continue
        const title = firstText(row.title) ?? `Post by ${authorName}`
        const media = firstImage(row.media_url)
        hits.push({
          id: String(row.id),
          type: 'post',
          title,
          subtitle: [`Post by ${authorName}`, displayDate(row.created_at), firstText(row.type)].filter(Boolean).join(' · '),
          snippet: cleanSnippet(row.content),
          url: `/feed/${row.id}`,
          avatarUrl: firstText(profile?.avatar_url),
          authorName,
          authorAvatarUrl: firstText(profile?.avatar_url),
          createdAt: firstText(row.created_at),
          thumbnailUrl: media ?? fallbackThumbnail('post', title),
          thumbnailKind: row.media_type === 'video' || row.type === 'video' ? 'video' : 'image',
        })
        if (hits.length >= limit * 2 && filter !== 'all') break
      }
    }

    if (include('service') || include('product') || include('grassroots')) {
      const listingLimit = filter === 'all' ? perType : limit
      const { data } = await supabase
        .from('listings')
        .select('*, profiles!seller_id(id, full_name, avatar_url)')
        .eq('status', 'active')
        .or(searchOr(['title', 'description', 'category', 'location'], q))
        .order('created_at', { ascending: false })
        .limit(listingLimit * 3)
      for (const row of ((data ?? []) as any[])) {
        const productType = String(row.product_type ?? '')
        const type: HitType = productType === 'service' ? 'service' : productType === 'grassroots' ? 'grassroots' : 'product'
        if (!include(type)) continue
        const title = firstText(row.title) ?? TYPE_META[type].label
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        hits.push({
          id: String(row.id),
          type,
          title,
          subtitle: [firstText(row.category), firstText(row.location)].filter(Boolean).join(' · ') || undefined,
          snippet: cleanSnippet(row.description),
          url: type === 'service' ? `/services/${row.id}` : type === 'grassroots' ? `/grassroots/${row.id}` : `/products/${row.id}`,
          avatarUrl: firstText(profile?.avatar_url),
          authorName: firstText(profile?.full_name),
          authorAvatarUrl: firstText(profile?.avatar_url),
          createdAt: firstText(row.created_at),
          thumbnailUrl: firstImage(row.cover_image, row.images) ?? fallbackThumbnail(type, title),
          thumbnailKind: 'image',
        })
      }
    }

    if (include('job')) {
      const { data } = await supabase
        .from('jobs')
        .select('*, poster:profiles!poster_id(id, full_name, avatar_url), org:organisations!org_id(id, name, logo_url)')
        .eq('status', 'active')
        .or(REAL_JOB_SOURCE_FILTER)
        .or(searchOr(['title', 'description', 'company_name', 'location', 'city', 'country'], q))
        .order('created_at', { ascending: false })
        .limit(filter === 'all' ? perType : limit)
      for (const row of ((data ?? []) as any[])) {
        const title = firstText(row.title) ?? 'Job'
        const org = Array.isArray(row.org) ? row.org[0] : row.org
        const poster = Array.isArray(row.poster) ? row.poster[0] : row.poster
        const authorName = firstText(row.company_name, org?.name, poster?.full_name)
        hits.push({
          id: String(row.id),
          type: 'job',
          title,
          subtitle: [authorName, firstText(row.location, row.city, row.country)].filter(Boolean).join(' · ') || undefined,
          snippet: cleanSnippet(row.description),
          url: `/jobs/${row.id}`,
          avatarUrl: firstText(org?.logo_url, poster?.avatar_url),
          authorName,
          authorAvatarUrl: firstText(org?.logo_url, poster?.avatar_url),
          createdAt: firstText(row.created_at),
          thumbnailUrl: firstImage(org?.logo_url, poster?.avatar_url) ?? fallbackThumbnail('job', title),
          thumbnailKind: 'image',
        })
      }
    }

    if (include('event')) {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .or(REAL_EVENT_SOURCE_FILTER)
        .or(searchOr(['title', 'description', 'category', 'location'], q))
        .order('starts_at', { ascending: true })
        .limit(filter === 'all' ? perType : limit)
      for (const row of ((data ?? []) as any[])) {
        const title = firstText(row.title) ?? 'Event'
        hits.push({
          id: String(row.id),
          type: 'event',
          title,
          subtitle: [displayDate(row.starts_at), firstText(row.category, row.location)].filter(Boolean).join(' · ') || undefined,
          snippet: cleanSnippet(row.description),
          url: `/events/${row.id}`,
          createdAt: firstText(row.starts_at, row.created_at),
          thumbnailUrl: firstImage(row.image_url, row.cover_image, row.thumbnail_url) ?? fallbackThumbnail('event', title),
          thumbnailKind: 'image',
        })
      }
    }

    if (include('article')) {
      const { data } = await supabase
        .from('articles')
        .select('*')
        .or(searchOr(['title', 'excerpt', 'content'], q))
        .order('created_at', { ascending: false })
        .limit(filter === 'all' ? perType : limit)
      for (const row of ((data ?? []) as any[])) {
        const title = firstText(row.title) ?? 'Article'
        hits.push({
          id: String(row.id),
          type: 'article',
          title,
          subtitle: displayDate(row.created_at) ?? undefined,
          snippet: cleanSnippet(row.excerpt ?? row.content),
          url: `/articles/${row.slug ?? row.id}`,
          createdAt: firstText(row.created_at),
          thumbnailUrl: firstImage(row.cover_image, row.image_url, row.thumbnail_url) ?? fallbackThumbnail('article', title),
          thumbnailKind: 'image',
        })
      }
    }

    if (include('org')) {
      const { data } = await supabase
        .from('organisations')
        .select('*')
        .or(searchOr(['name', 'description', 'category', 'location'], q))
        .limit(filter === 'all' ? perType : limit)
      for (const row of ((data ?? []) as any[])) {
        const title = firstText(row.name) ?? 'Organisation'
        hits.push({
          id: String(row.id),
          type: 'org',
          title,
          subtitle: [firstText(row.category), firstText(row.location)].filter(Boolean).join(' · ') || undefined,
          snippet: cleanSnippet(row.description),
          url: `/organisations/${row.id}`,
          avatarUrl: firstText(row.logo_url),
          authorName: title,
          authorAvatarUrl: firstText(row.logo_url),
          createdAt: firstText(row.created_at),
          thumbnailUrl: firstImage(row.cover_image, row.logo_url) ?? fallbackThumbnail('org', title),
          thumbnailKind: 'image',
        })
      }
    }

    const seen = new Set<string>()
    const unique = hits.filter((hit) => {
      const key = `${hit.type}:${hit.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, limit)

    return NextResponse.json(
      { hits: unique, total: unique.length, query: q, filter, scope },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[GET /api/search]', err)
    return NextResponse.json({ hits: [], total: 0, query: '', error: 'Search failed' }, { status: 500 })
  }
}
