export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the admin (service-role) client for all three queries so
    // RLS on rent_share_listings (which may not have a SELECT policy
    // for auth.uid() = user_id if the schema init file was never
    // applied) can't silently return zero rows. We've already
    // validated user.id from the session above, so filtering by it
    // via the admin client is safe — the caller can only see their
    // own items.
    const admin = createAdminClient()

    const [servicesRes, productsRes, rentShareRes] = await Promise.all([
      admin
        .from('listings')
        .select('id, title, price, currency, cover_image, status, created_at, product_type')
        .eq('seller_id', user.id)
        .eq('product_type', 'service')
        .order('created_at', { ascending: false }),
      admin
        .from('listings')
        .select('id, title, price, currency, cover_image, status, created_at, product_type')
        .eq('seller_id', user.id)
        .neq('product_type', 'service')
        .order('created_at', { ascending: false }),
      admin
        .from('rent_share_listings')
        .select('id, title, price_per_day, currency, images, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    const services = (servicesRes.data ?? []).map(s => ({
      id: s.id,
      title: s.title,
      price: s.price,
      currency: s.currency ?? 'EUR',
      thumbnail_url: s.cover_image ?? null,
      status: s.status ?? 'active',
      created_at: s.created_at,
      type: 'service' as const,
    }))

    const products = (productsRes.data ?? []).map(p => ({
      id: p.id,
      title: p.title,
      price: p.price,
      currency: p.currency ?? 'EUR',
      thumbnail_url: p.cover_image ?? null,
      status: p.status ?? 'active',
      created_at: p.created_at,
      type: 'product' as const,
    }))

    const rentShare = (rentShareRes.data ?? []).map(r => {
      const imgs = r.images as string[] | null
      return {
        id: r.id,
        title: r.title,
        price_per_day: r.price_per_day,
        currency: (r.currency as string | null) ?? 'EUR',
        thumbnail_url: imgs?.[0] ?? null,
        status: r.status ?? 'active',
        created_at: r.created_at,
        type: 'rent_share' as const,
      }
    })

    return NextResponse.json({ services, products, rentShare })
  } catch (err) {
    console.error('[GET /api/me/listings]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
