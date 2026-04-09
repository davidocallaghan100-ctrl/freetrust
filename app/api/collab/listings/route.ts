import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/collab/listings?type=product|service&min_trust=0&category=&q=&page=1
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const type = searchParams.get('type') || 'product'
    const minTrust = parseInt(searchParams.get('min_trust') ?? '0')
    const category = searchParams.get('category') || ''
    const search = searchParams.get('q') || ''
    const minPrice = parseFloat(searchParams.get('min_price') ?? '0')
    const maxPrice = parseFloat(searchParams.get('max_price') ?? '999999')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 20
    const offset = (page - 1) * limit

    // Fetch listings joined with seller profile and trust balance
    // type=service → product_type='service', type=product → product_type in ('digital','physical')
    let query = supabase
      .from('listings')
      .select(`
        id, seller_id, title, description, price, currency, status, images, tags, views, created_at, category_id, product_type, location,
        profiles!seller_id(id, full_name, avatar_url, location),
        trust_balances!seller_id(balance)
      `, { count: 'exact' })
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by type: 'service' → product_type=service, 'product' → digital or physical
    if (type === 'service') {
      query = query.eq('product_type', 'service')
    } else if (type === 'product') {
      query = query.in('product_type', ['digital', 'physical'])
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
    }
    if (category) {
      query = query.eq('category_id', category)
    }
    if (minPrice > 0) {
      query = query.gte('price', minPrice)
    }
    if (maxPrice < 999999) {
      query = query.lte('price', maxPrice)
    }

    const { data: listings, error, count } = await query

    if (error) {
      console.error('[GET /api/collab/listings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Filter by min_trust in memory (trust_balances join)
    const filtered = (listings ?? []).filter((l: any) => {
      const balance = l.trust_balances?.balance ?? 0
      return balance >= minTrust
    })

    return NextResponse.json({
      listings: filtered,
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('[GET /api/collab/listings] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
