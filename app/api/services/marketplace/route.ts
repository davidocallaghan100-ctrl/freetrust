export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const admin = createAdminClient()
    const services: unknown[] = []
    const pageSize = 1000
    let total: number | null = null

    for (let from = 0; ; from += pageSize) {
      const { data, error, count } = await admin
        .from('listings')
        .select('id, created_at, title, description, price, currency, service_mode, tags, location, cover_image, avg_rating, review_count, country, city, region, latitude, longitude, location_label, is_remote, currency_code, price_eur, category, category_id, seller:profiles!seller_id(id, full_name, avatar_url, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url)', { count: from === 0 ? 'exact' : undefined })
        .eq('product_type', 'service')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(from, from + pageSize - 1)

      if (error) {
        console.error('[GET /api/services/marketplace]', error)
        return NextResponse.json({ error: error.message, services: [] }, { status: 500 })
      }

      if (from === 0) total = count ?? null
      services.push(...(data ?? []))
      if (!data || data.length < pageSize) break
    }

    return NextResponse.json(
      { services, total: total ?? services.length },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/services/marketplace] unexpected:', message)
    return NextResponse.json({ error: 'Internal server error', services: [] }, { status: 500 })
  }
}
