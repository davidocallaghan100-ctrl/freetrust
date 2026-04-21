export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = params
    const admin = createAdminClient()

    const { data: po } = await admin.from('pending_orders').select('*').eq('id', id).maybeSingle()
    if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json().catch(() => ({})) as { action?: string }

    if (body.action === 'cancel') {
      if ((po.buyer_id as string) !== user.id) return NextResponse.json({ error: 'Only the buyer can cancel' }, { status: 403 })
      if (po.status !== 'pending') return NextResponse.json({ error: 'Can only cancel pending orders' }, { status: 400 })
      const { data: updated } = await admin.from('pending_orders').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', id).select().single()
      return NextResponse.json({ pendingOrder: updated })
    }

    if (body.action === 'decline') {
      if ((po.seller_id as string) !== user.id) return NextResponse.json({ error: 'Only the seller can decline' }, { status: 403 })
      if (po.status !== 'pending') return NextResponse.json({ error: 'Can only decline pending orders' }, { status: 400 })
      const { data: updated } = await admin.from('pending_orders').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', id).select().single()

      const { data: seller } = await admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      try {
        await insertNotification({
          userId: po.buyer_id as string,
          type: 'pending_order_declined',
          title: `${(seller?.full_name as string | null) ?? 'The seller'} declined your request`,
          body: `"${po.listing_title}" — you can browse other listings.`,
          link: '/browse',
        })
      } catch (e) { console.error('[pending-orders] decline notification failed:', e) }

      return NextResponse.json({ pendingOrder: updated })
    }

    return NextResponse.json({ error: 'Invalid action. Use cancel or decline.' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/pending-orders/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
