import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service detail is public marketplace data, so it can be revalidated at the
// edge without waiting for the browser's Supabase auth/session state.
export const revalidate = 30

const UUID_RE = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){2}[0-9a-f]{4}-[0-9a-f]{12}$/i
const LOOKUP_TIMEOUT_MS = 7_000

function createTimedAdminClient(signal: AbortSignal) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase admin credentials')

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal }),
    },
  })
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)

  try {
    const admin = createTimedAdminClient(controller.signal)
    const { data: service, error } = await admin
      .from('listings')
      .select(`
        id, title, description, price, currency, price_eur,
        service_mode, tags, location,
        images, category_id, category, delivery_types,
        quality_score, avg_rating, review_count,
        seller:profiles!seller_id (
          id, full_name, avatar_url, bio, location
        )
      `)
      .eq('id', id)
      .eq('product_type', 'service')
      .eq('status', 'active')
      .maybeSingle()

    if (controller.signal.aborted) {
      return NextResponse.json({ error: 'Service lookup timed out' }, { status: 504, headers: { 'Cache-Control': 'no-store' } })
    }
    if (error) {
      console.error('[GET /api/services/marketplace/[id]]', error)
      return NextResponse.json({ error: 'Could not load this service' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json(
      { service },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=120' } },
    )
  } catch (error) {
    if (controller.signal.aborted) {
      return NextResponse.json({ error: 'Service lookup timed out' }, { status: 504, headers: { 'Cache-Control': 'no-store' } })
    }
    console.error('[GET /api/services/marketplace/[id]] unexpected:', error)
    return NextResponse.json({ error: 'Could not load this service' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  } finally {
    clearTimeout(timeoutId)
  }
}
