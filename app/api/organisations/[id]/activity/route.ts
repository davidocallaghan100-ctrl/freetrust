export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/organisations/[id]/activity
// Returns a unified feed of everything posted on behalf of this org:
// jobs (org_id = orgId), events (org_id = orgId), listings (org_id = orgId)

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: orgId } = params
    if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

    const admin = createAdminClient()

    const [jobsRes, eventsRes, listingsRes] = await Promise.all([
      admin
        .from('jobs')
        .select('id, title, job_type, location_type, status, applicant_count, company_logo_url, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('events')
        .select('id, title, start_date, location, is_online, cover_url, attendee_count, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
      admin
        .from('listings')
        .select('id, title, product_type, price, currency, status, images, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    type OrgActivityItem = {
      id: string
      type: 'job' | 'event' | 'listing'
      title: string
      subtitle?: string
      image_url?: string | null
      created_at: string
      link: string
      meta?: string
      status?: string
    }

    const items: OrgActivityItem[] = []

    for (const j of (jobsRes.data ?? [])) {
      items.push({
        id:         `job-${j.id}`,
        type:       'job',
        title:      (j.title as string) ?? 'Job posting',
        subtitle:   [j.job_type, j.location_type].filter(Boolean).join(' · '),
        image_url:  j.company_logo_url as string | null ?? null,
        created_at: j.created_at as string,
        link:       `/jobs/${j.id}`,
        meta:       `👥 ${(j.applicant_count as number) ?? 0} applicants`,
        status:     j.status as string,
      })
    }

    for (const e of (eventsRes.data ?? [])) {
      items.push({
        id:         `event-${e.id}`,
        type:       'event',
        title:      (e.title as string) ?? 'Event',
        subtitle:   e.is_online ? '🌐 Online' : `📍 ${e.location ?? 'In person'}`,
        image_url:  e.cover_url as string | null ?? null,
        created_at: e.created_at as string,
        link:       `/events/${e.id}`,
        meta:       `👥 ${(e.attendee_count as number) ?? 0} attending`,
      })
    }

    for (const l of (listingsRes.data ?? [])) {
      const isService = l.product_type === 'service'
      const images = Array.isArray(l.images) ? l.images : []
      items.push({
        id:         `listing-${l.id}`,
        type:       'listing',
        title:      (l.title as string) ?? 'Listing',
        subtitle:   isService ? '🛠 Service' : '📦 Product',
        image_url:  images[0] ?? null,
        created_at: l.created_at as string,
        link:       `/services/${l.id}`,
        status:     l.status as string,
      })
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    console.error('[GET /api/organisations/[id]/activity]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
