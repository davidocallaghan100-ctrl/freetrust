export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { awardDeliveryTrust } from '@/lib/trust/deliveryRewards'
import { logActivity } from '@/lib/activity/logActivity'

// POST /api/disputes/[id]/resolve
// Resolves the dispute. Currently open to the involved parties for self-resolution,
// or can be called by admin. Full admin-gate can be added later.
// Body: { in_favour_of: 'buyer' | 'seller' | 'split', admin_notes?: string }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { in_favour_of, admin_notes } = body

    if (!['buyer', 'seller', 'split'].includes(in_favour_of)) {
      return NextResponse.json({ error: 'in_favour_of must be buyer, seller, or split' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Fetch dispute with full order info
    const { data: dispute } = await adminClient
      .from('disputes')
      .select('*, order:orders!order_id(id, buyer_id, seller_id, stripe_payment_intent, amount, status)')
      .eq('id', id)
      .single()

    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    if (dispute.status === 'resolved' || dispute.closed_at) {
      return NextResponse.json({ error: 'Dispute is already closed' }, { status: 422 })
    }

    const order = dispute.order as {
      id: string; buyer_id: string; seller_id: string;
      stripe_payment_intent: string | null; amount: number; status: string
    } | null
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Verify user is party to the dispute or an admin
    const isBuyer  = order.buyer_id  === user.id
    const isSeller = order.seller_id === user.id
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = (profile as { role?: string } | null)?.role === 'admin'

    if (!isBuyer && !isSeller && !isAdmin) {
      return NextResponse.json({ error: 'Not authorised to resolve this dispute' }, { status: 403 })
    }

    const now = new Date().toISOString()

    // Determine order outcome
    let orderStatus: string
    if (in_favour_of === 'buyer') {
      orderStatus = 'refunded'
    } else if (in_favour_of === 'seller') {
      orderStatus = 'completed'
    } else {
      // split — mark completed, partial refund handled separately
      orderStatus = 'completed'
    }

    // Update dispute
    const { data: updated, error } = await adminClient
      .from('disputes')
      .update({
        status:                  'resolved',
        resolved_in_favour_of:   in_favour_of,
        admin_notes:             admin_notes ?? null,
        closed_at:               now,
        resolved_by:             user.id,
        resolved_at:             now,
        updated_at:              now,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Update order status
    await adminClient.from('orders').update({ status: orderStatus }).eq('id', dispute.order_id)

    // Trust consequences
    if (in_favour_of === 'buyer') {
      // Seller loses trust — dispute resolved against them
      void awardDeliveryTrust(order.seller_id, 'dispute_lost', order.id)
    } else if (in_favour_of === 'seller') {
      // Seller wins — release payment reward (buyer confirmed is similar weight)
      void awardDeliveryTrust(order.seller_id, 'buyer_confirmed', order.id)
    }
    // split: no trust change — neutral outcome

    // Log to activity feed
    const outcomeLabel =
      in_favour_of === 'buyer'  ? '🛒 Resolved in favour of buyer'  :
      in_favour_of === 'seller' ? '🏪 Resolved in favour of seller' :
                                  '⚖️ Resolved with split outcome'

    void logActivity({
      orderId:   order.id,
      actorId:   user.id,
      actorRole: isAdmin ? 'system' : (isBuyer ? 'buyer' : 'seller'),
      eventType: 'dispute_resolved',
      title:     outcomeLabel,
      body:      admin_notes ?? undefined,
    })

    return NextResponse.json({ dispute: updated, orderStatus })
  } catch (err) {
    console.error('[POST /api/disputes/[id]/resolve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
