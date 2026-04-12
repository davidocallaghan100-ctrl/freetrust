export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
      location?: string
      taggedUsers?: string
      category?: string
    } | null

    if (!body || !body.type || !body.data) {
      return fail('Invalid request body', 400)
    }

    const { type, data, location, category } = body
    const admin = createAdminClient()

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

      // location_type is NOT NULL in the schema. Infer from the location
      // string: empty / "remote" → remote, otherwise on_site.
      const locText = String(data.location ?? location ?? '').toLowerCase()
      const locationType =
        !locText || locText.includes('remote') ? 'remote' :
        locText.includes('hybrid') ? 'hybrid' : 'on_site'

      const { data: inserted, error } = await admin.from('jobs').insert({
        poster_id: user.id,
        title,
        description,
        requirements: data.requirements ?? null,
        job_type: jobType,
        location_type: locationType,
        location: data.location ?? location ?? null,
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        salary_currency: 'GBP',
        category: category ?? 'General',
        status: 'active', // NOT 'open' — schema CHECK expects active/closed/draft
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

      const { data: inserted, error } = await admin.from('events').insert({
        creator_id: user.id,
        title,
        description,
        starts_at: startDate,
        ends_at: data.end_date ? String(data.end_date) : null,
        venue_name: location || null,
        is_online: false,
        cover_image_url: data.cover_image_url ?? null,
        ticket_price: data.price ? Number(data.price) : 0,
        is_paid: Boolean(data.price && Number(data.price) > 0),
        max_attendees: data.max_attendees ? Number(data.max_attendees) : null,
        category: category ?? 'General',
        status: 'published',
        attendee_count: 0,
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

      const { data: inserted, error } = await admin.from('services').insert({
        seller_id: user.id,
        title,
        description,
        price: data.price ? Number(data.price) : 0,
        currency: 'GBP',
        category: category ?? 'General',
        status: 'active',
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

      const { error } = await admin.from('listings').insert({
        seller_id: user.id,
        title,
        description,
        price: data.price ? Number(data.price) : 0,
        currency: 'GBP',
        product_type: 'physical',
        status: 'active',
        images: parsedImages,
        tags: [],
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
