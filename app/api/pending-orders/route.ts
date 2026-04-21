export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null) as { listingId?: string; listingType?: string; message?: string } | null
    const listingId = body?.listingId
    const listingType = body?.listingType
    if (!listingId || !listingType || !['service', 'product', 'rent_share'].includes(listingType)) {
      return NextResponse.json({ error: 'listingId and listingType (service|product|rent_share) are required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Look up listing to get seller info + price
    let sellerId: string | null = null
    let title = ''
    let priceCents = 0
    let currency = 'EUR'

    if (listingType === 'rent_share') {
      const { data: rs } = await admin.from('rent_share_listings').select('id, user_id, title, price_per_day').eq('id', listingId).maybeSingle()
      if (!rs) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      sellerId = rs.user_id as string
      title = rs.title as string
      priceCents = Math.round(((rs.price_per_day as number) ?? 0) * 100)
    } else {
      const { data: lst } = await admin.from('listings').select('id, seller_id, title, price, currency').eq('id', listingId).maybeSingle()
      if (!lst) return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
      sellerId = lst.seller_id as string
      title = lst.title as string
      priceCents = Math.round(((lst.price as number) ?? 0) * 100)
      currency = (lst.currency as string) ?? 'EUR'
    }

    if (sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot request your own listing' }, { status: 400 })
    }

    // Check if seller already has Stripe connected
    const { data: sellerProfile } = await admin.from('profiles').select('stripe_onboarded').eq('id', sellerId).maybeSingle()
    if (sellerProfile?.stripe_onboarded) {
      return NextResponse.json({ error: 'This seller accepts direct purchases — use the Buy button' }, { status: 400 })
    }

    // Insert pending order
    const { data: po, error: insertErr } = await admin.from('pending_orders').insert({
      buyer_id: user.id,
      seller_id: sellerId,
      listing_id: listingId,
      listing_type: listingType,
      listing_title: title,
      listing_price_cents: priceCents,
      listing_currency: currency,
      message: body?.message?.trim() || null,
    }).select().single()

    if (insertErr) {
      if (insertErr.code === '23505') {
        return NextResponse.json({ error: 'You already have a pending request for this listing' }, { status: 409 })
      }
      console.error('[pending-orders] insert failed:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Notify seller
    const { data: buyerProfile } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    try {
      await insertNotification({
        userId: sellerId,
        type: 'pending_order',
        title: `${(buyerProfile?.full_name as string | null) ?? 'A buyer'} is interested in your listing`,
        body: `"${title}" — Connect Stripe to accept orders.`,
        link: '/dashboard/pending-orders',
      })
    } catch (e) { console.error('[pending-orders] notification failed:', e) }

    return NextResponse.json({ pendingOrder: po }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/pending-orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Expire stale pending orders lazily
    await admin.from('pending_orders').update({ status: 'expired', updated_at: new Date().toISOString() }).eq('status', 'pending').lt('expires_at', new Date().toISOString())

    const { data: rows } = await admin.from('pending_orders').select('*, buyer:profiles!buyer_id(id, full_name, avatar_url), seller:profiles!seller_id(id, full_name, avatar_url)').or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`).order('created_at', { ascending: false })

    const all = rows ?? []
    return NextResponse.json({
      asBuyer: all.filter(r => (r.buyer_id as string) === user.id),
      asSeller: all.filter(r => (r.seller_id as string) === user.id),
    })
  } catch (err) {
    console.error('[GET /api/pending-orders]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
