export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StructuredLocation } from '@/lib/geo'
import { toPgUrlArray, toPgTagArray } from '@/lib/supabase/text-array'

// Map UI-friendly labels (from the create form) to the DB CHECK constraint
// values defined in lib/supabase/jobs-schema.sql.
const JOB_TYPE_MAP: Record<string, string> = {
  'Full-time':  'full_time',
  'Part-time':  'part_time',
  'Contract':   'contract',
  'Freelance':  'freelance',
  'Internship': 'contract', // schema doesn't have internship — map to contract
}

function fail(message: string, status = 500) {
  return NextResponse.json({ error: message }, { status })
}

// ── Globalisation helpers ──────────────────────────────────────────────────
// The create forms may optionally attach a structured location object and
// the listing's source currency. We normalise both here so every insert
// path stores the same shape.
interface ListingLocation extends Partial<StructuredLocation> {
  is_remote?: boolean
}

function normaliseLocation(raw: unknown): ListingLocation {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  return {
    country:        typeof r.country        === 'string' ? r.country.toUpperCase() : null,
    region:         typeof r.region         === 'string' ? r.region  : null,
    city:           typeof r.city           === 'string' ? r.city    : null,
    latitude:       typeof r.latitude       === 'number' ? r.latitude  : null,
    longitude:      typeof r.longitude      === 'number' ? r.longitude : null,
    location_label: typeof r.location_label === 'string' ? r.location_label : null,
    is_remote:      Boolean(r.is_remote),
  }
}

// Fetch the latest EUR rate for `from` from frankfurter so every listing
// is stored with a canonical `price_eur` value. Cached per-cold-start in a
// module-level map keyed by source currency. Value is the multiplier to
// go from `from` → EUR (e.g. 0.926 for USD → EUR).
// Falls back to identity conversion if the API errors, which keeps writes
// from failing on network issues.
const EUR_MULTIPLIER_CACHE = new Map<string, { mult: number; at: number }>()
const RATE_TTL_MS = 60 * 60 * 1000 // 1 hour

async function toEur(amount: number, fromCurrency: string | null | undefined): Promise<number> {
  if (!Number.isFinite(amount)) return 0
  const from = (fromCurrency ?? 'EUR').toUpperCase()
  if (from === 'EUR' || amount === 0) return Math.round(amount * 100) / 100

  const cached = EUR_MULTIPLIER_CACHE.get(from)
  if (cached && Date.now() - cached.at < RATE_TTL_MS) {
    return Math.round(amount * cached.mult * 100) / 100
  }
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(from)}&to=EUR`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`frankfurter ${res.status}`)
    const d = await res.json() as { rates?: { EUR?: number } }
    const mult = d.rates?.EUR
    if (typeof mult !== 'number' || !(mult > 0)) throw new Error('bad rate')
    EUR_MULTIPLIER_CACHE.set(from, { mult, at: Date.now() })
    return Math.round(amount * mult * 100) / 100
  } catch {
    return Math.round(amount * 100) / 100 // identity fallback
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return fail('Unauthorized', 401)
    }

    const body = await req.json().catch(() => null) as {
      type?: string
      data?: Record<string, unknown>
      visibility?: string
      location?: string                   // legacy free-text (still accepted)
      structured_location?: unknown       // new: StructuredLocation from LocationPicker
      is_remote?: boolean                 // new: remote toggle for services/jobs
      currency_code?: string              // new: ISO 4217 e.g. "GBP"
      taggedUsers?: string
      category?: string
    } | null

    if (!body || !body.type || !body.data) {
      return fail('Invalid request body', 400)
    }

    const { type, data, location, category } = body
    const admin = createAdminClient()

    // Normalise the structured location once — every insert path uses it
    const struct = normaliseLocation(body.structured_location)
    const isRemote = Boolean(body.is_remote ?? struct.is_remote ?? false)
    const currencyCode = (body.currency_code ?? 'EUR').toUpperCase()

    let redirectUrl = '/feed'

    // ── Article → articles table ────────────────────────────────────────────
    if (type === 'article') {
      const title = String(data.title ?? '').trim()
      const bodyText = String(data.body ?? '').trim()
      if (!title) return fail('Article title is required', 400)
      if (!bodyText) return fail('Article body is required', 400)

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + Date.now().toString(36)

      const { error } = await admin.from('articles').insert({
        author_id: user.id,
        title,
        slug,
        body: bodyText,
        excerpt: bodyText.slice(0, 200),
        featured_image_url: data.cover_image_url ?? null,
        status: 'published',
        category: category ?? 'General',
        published_at: new Date().toISOString(),
      })
      if (error) {
        console.error('[publish article]', error)
        return fail(`Could not save article: ${error.message}`)
      }
      redirectUrl = '/articles'
    }

    // ── Job → jobs table ────────────────────────────────────────────────────
    else if (type === 'job') {
      const title = String(data.title ?? '').trim()
      const description = String(data.description ?? '').trim()
      if (!title) return fail('Job title is required', 400)
      if (!description) return fail('Job description is required', 400)

      // Map UI label to schema CHECK value. Default to full_time if we don't
      // recognise it so the insert doesn't fail the CHECK constraint.
      const uiJobType = String(data.job_type ?? 'Full-time')
      const jobType = JOB_TYPE_MAP[uiJobType] ?? 'full_time'

      // location_type is NOT NULL in the schema. Prefer explicit is_remote
      // toggle; otherwise fall back to the legacy free-text inference.
      const locText = String(data.location ?? location ?? struct.location_label ?? '').toLowerCase()
      const locationType = isRemote
        ? 'remote'
        : locText.includes('hybrid') ? 'hybrid'
        : struct.latitude != null   ? 'on_site'
        : !locText || locText.includes('remote') ? 'remote' : 'on_site'

      const salaryMin = data.salary_min ? Number(data.salary_min) : null
      const salaryMax = data.salary_max ? Number(data.salary_max) : null
      const salaryMinEur = salaryMin != null ? await toEur(salaryMin, currencyCode) : null
      const salaryMaxEur = salaryMax != null ? await toEur(salaryMax, currencyCode) : null

      const { data: inserted, error } = await admin.from('jobs').insert({
        poster_id: user.id,
        title,
        description,
        requirements: data.requirements ?? null,
        job_type: jobType,
        location_type: locationType,
        location: struct.location_label ?? data.location ?? location ?? null,
        salary_min: salaryMin,
        salary_max: salaryMax,
        salary_currency: currencyCode,
        category: category ?? 'General',
        status: 'active', // NOT 'open' — schema CHECK expects active/closed/draft
        // ── Globalisation fields ────────────────────────────────────────
        country:        struct.country ?? null,
        region:         struct.region ?? null,
        city:           struct.city ?? null,
        latitude:       struct.latitude ?? null,
        longitude:      struct.longitude ?? null,
        location_label: struct.location_label ?? null,
        is_remote:      locationType === 'remote',
        currency_code:  currencyCode,
        salary_min_eur: salaryMinEur,
        salary_max_eur: salaryMaxEur,
      }).select('id').single()
      if (error) {
        console.error('[publish job]', error)
        return fail(`Could not save job: ${error.message}`)
      }
      redirectUrl = inserted?.id ? `/jobs/${inserted.id}` : '/jobs'
    }

    // ── Event → events table (not community_events) ────────────────────────
    // The feed's fetchEvents reads from `events` with status='published' and
    // starts_at >= now(). Saving to community_events would hide the event
    // from the feed's Events filter tab.
    else if (type === 'event') {
      const title = String(data.title ?? '').trim()
      const description = String(data.description ?? '').trim()
      const startDate = data.start_date ? String(data.start_date) : null
      if (!title) return fail('Event title is required', 400)
      if (!startDate) return fail('Event start date is required', 400)

      const ticketPrice = data.price ? Number(data.price) : 0
      const ticketPriceEur = ticketPrice > 0 ? await toEur(ticketPrice, currencyCode) : 0

      const { data: inserted, error } = await admin.from('events').insert({
        creator_id: user.id,
        title,
        description,
        starts_at: startDate,
        ends_at: data.end_date ? String(data.end_date) : null,
        venue_name: struct.location_label ?? location ?? null,
        is_online: isRemote,
        cover_image_url: data.cover_image_url ?? null,
        ticket_price: ticketPrice,
        is_paid: ticketPrice > 0,
        max_attendees: data.max_attendees ? Number(data.max_attendees) : null,
        category: category ?? 'General',
        status: 'published',
        attendee_count: 0,
        // ── Globalisation fields ────────────────────────────────────────
        country:          struct.country ?? null,
        region:           struct.region ?? null,
        city:             struct.city ?? null,
        latitude:         struct.latitude ?? null,
        longitude:        struct.longitude ?? null,
        location_label:   struct.location_label ?? null,
        currency_code:    currencyCode,
        ticket_price_eur: ticketPriceEur,
      }).select('id').single()
      if (error) {
        console.error('[publish event]', error)
        return fail(`Could not save event: ${error.message}`)
      }
      redirectUrl = inserted?.id ? `/events/${inserted.id}` : '/events'
    }

    // ── Service → services table (not listings) ────────────────────────────
    // The feed's fetchServices reads from `services` with status='active'.
    // Saving to `listings` would hide services from the feed's Services tab.
    else if (type === 'service') {
      const title = String(data.title ?? '').trim()
      const description = String(data.description ?? '').trim()
      if (!title) return fail('Service title is required', 400)
      if (!description) return fail('Service description is required', 400)

      const price = data.price ? Number(data.price) : 0
      const priceEur = await toEur(price, currencyCode)

      const { data: inserted, error } = await admin.from('services').insert({
        seller_id: user.id,
        title,
        description,
        price,
        currency: currencyCode,
        category: category ?? 'General',
        status: 'active',
        // ── Globalisation fields ────────────────────────────────────────
        country:        struct.country ?? null,
        region:         struct.region ?? null,
        city:           struct.city ?? null,
        latitude:       isRemote ? null : struct.latitude ?? null,
        longitude:      isRemote ? null : struct.longitude ?? null,
        location_label: isRemote ? null : struct.location_label ?? null,
        is_remote:      isRemote,
        currency_code:  currencyCode,
        price_eur:      priceEur,
      }).select('id').single()
      if (error) {
        console.error('[publish service]', error)
        return fail(`Could not save service: ${error.message}`)
      }
      redirectUrl = inserted?.id ? `/services/${inserted.id}` : '/services'
    }

    // ── Product → listings table (marketplace) ─────────────────────────────
    else if (type === 'product') {
      const title = String(data.title ?? '').trim()
      const description = String(data.description ?? '').trim()
      if (!title) return fail('Product title is required', 400)
      if (!description) return fail('Product description is required', 400)

      const rawImages = data.images
      const parsedImages = Array.isArray(rawImages)
        ? rawImages
        : typeof rawImages === 'string'
          ? rawImages.split('\n').map(s => s.trim()).filter(Boolean)
          : []

      const price = data.price ? Number(data.price) : 0
      const priceEur = await toEur(price, currencyCode)

      // Encode text[] columns as Postgres array literals — workaround
      // for the "expected pattern" PostgREST coercion bug; see
      // lib/supabase/text-array.ts for the history.
      const imagesLiteral = toPgUrlArray(parsedImages)
      const tagsLiteral   = toPgTagArray([])

      const { error } = await admin.from('listings').insert({
        seller_id: user.id,
        title,
        description,
        price,
        currency: currencyCode,
        product_type: 'physical',
        status: 'active',
        images: imagesLiteral,
        tags:   tagsLiteral,
        // ── Globalisation fields ────────────────────────────────────────
        country:        struct.country ?? null,
        region:         struct.region ?? null,
        city:           struct.city ?? null,
        latitude:       struct.latitude ?? null,
        longitude:      struct.longitude ?? null,
        location_label: struct.location_label ?? null,
        is_remote:      false,
        currency_code:  currencyCode,
        price_eur:      priceEur,
      })
      if (error) {
        console.error('[publish product]', error)
        return fail(`Could not save product: ${error.message}`)
      }
      redirectUrl = '/products'
    }

    // ── text/photo/video/short/link/poll → feed_posts ──────────────────────
    else {
      const mediaUrl = (data.media_url as string | null | undefined) ?? null

      // Validation per type
      if (type === 'text' && !String(data.content ?? '').trim()) {
        return fail('Text post cannot be empty', 400)
      }
      if ((type === 'photo' || type === 'video' || type === 'short') && !mediaUrl) {
        return fail('Upload a file before publishing', 400)
      }
      if (type === 'link' && !String(data.url ?? '').trim()) {
        return fail('Link URL is required', 400)
      }

      const typeContentMap: Record<string, { content: string; media_url?: string | null; title?: string; link_url?: string }> = {
        text:  { content: String(data.content ?? '').trim() },
        photo: { content: String(data.caption ?? ''), media_url: mediaUrl },
        video: { content: String(data.description ?? ''), title: String(data.title ?? ''), media_url: mediaUrl },
        short: { content: String(data.caption ?? ''), media_url: mediaUrl },
        link:  { content: String(data.description ?? ''), link_url: String(data.url ?? ''), title: String(data.link_title ?? '') },
        poll:  { content: JSON.stringify({ question: data.question, options: data.options, duration: data.duration }), title: String(data.question ?? '') },
      }

      const mapped = typeContentMap[type] ?? { content: String(data.content ?? ''), media_url: mediaUrl }

      const { error } = await admin.from('feed_posts').insert({
        user_id: user.id,
        type,
        content: mapped.content,
        title: mapped.title ?? null,
        link_url: mapped.link_url ?? null,
        media_url: mapped.media_url ?? null,
        media_type: type === 'photo' ? 'image' : type === 'video' || type === 'short' ? 'video' : null,
      })
      if (error) {
        console.error('[publish feed_post]', error)
        return fail(`Could not save post: ${error.message}`)
      }
    }

    return NextResponse.json({ success: true, redirectUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[publish] unhandled:', message, err)
    return fail(`Internal server error: ${message}`)
  }
}
