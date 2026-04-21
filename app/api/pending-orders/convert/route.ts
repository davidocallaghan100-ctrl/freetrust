export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { sellerId?: string } | null
    const sellerId = body?.sellerId
    if (!sellerId) return NextResponse.json({ error: 'sellerId required' }, { status: 400 })

    const admin = createAdminClient()

    const { data: seller } = await admin.from('profiles').select('full_name').eq('id', sellerId).maybeSingle()
    const sellerName = (seller?.full_name as string | null) ?? 'The seller'

    const { data: pending } = await admin.from('pending_orders').select('id, buyer_id, listing_id, listing_type, listing_title').eq('seller_id', sellerId).eq('status', 'pending').gt('expires_at', new Date().toISOString())

    let notified = 0
    for (const po of pending ?? []) {
      const lt = (po.listing_type as string) === 'rent_share' ? 'rent-share' : `${po.listing_type}s`
      try {
        await insertNotification({
          userId: po.buyer_id as string,
          type: 'pending_order_ready',
          title: `${sellerName} is now accepting orders`,
          body: `Complete your purchase for "${po.listing_title}"`,
          link: `/${lt}/${po.listing_id}`,
        })
        notified++
      } catch (e) { console.error('[pending-orders/convert] notification failed:', e) }
    }

    return NextResponse.json({ notified })
  } catch (err) {
    console.error('[POST /api/pending-orders/convert]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
