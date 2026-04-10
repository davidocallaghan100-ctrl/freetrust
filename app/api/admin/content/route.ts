export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') ?? 'all' // 'products' | 'services' | 'rent-share' | 'all'
    const search = searchParams.get('search') ?? ''
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 200)

    const results: {
      listings: unknown[]
      services: unknown[]
      rentShare: unknown[]
    } = { listings: [], services: [], rentShare: [] }

    if (type === 'all' || type === 'products') {
      let q = admin
        .from('listings')
        .select('id, title, description, price, status, product_type, images, created_at, seller_id, profiles!seller_id(full_name, email)')
        .neq('product_type', 'service')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (search) q = q.ilike('title', `%${search}%`)
      const { data } = await q
      results.listings = data ?? []
    }

    if (type === 'all' || type === 'services') {
      let q = admin
        .from('listings')
        .select('id, title, description, price, status, product_type, images, created_at, seller_id, profiles!seller_id(full_name, email)')
        .eq('product_type', 'service')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (search) q = q.ilike('title', `%${search}%`)
      const { data } = await q
      results.services = data ?? []
    }

    if (type === 'all' || type === 'rent-share') {
      let q = admin
        .from('rent_share_listings')
        .select('id, title, description, category, price_per_day, price_per_week, status, images, created_at, user_id, profiles!user_id(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (search) q = q.ilike('title', `%${search}%`)
      const { data, error } = await q
      // Table may not exist yet — return empty rather than crashing
      if (!error) results.rentShare = data ?? []
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('[GET /api/admin/content]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
