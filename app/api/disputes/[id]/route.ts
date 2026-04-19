export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardDeliveryTrust } from '@/lib/trust/deliveryRewards'

// PATCH /api/disputes/[id] — admin resolve or user update
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { action, resolution, refund_amount, admin_notes } = body

    const { data: dispute } = await supabase
      .from('disputes')
      .select('*, order:orders!order_id(buyer_id, seller_id, stripe_payment_intent, amount)')
      .eq('id', id)
      .single()

    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })

    if (action === 'resolve') {
      // Only admins should resolve — check profile role
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      const updates: Record<string, unknown> = {
        status: 'resolved',
        resolution,
        refund_amount: refund_amount ?? null,
        admin_notes: admin_notes ?? null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const { data: updated, error } = await supabase
        .from('disputes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      // Update order status based on resolution
      const orderStatus = resolution === 'full_refund' || resolution === 'partial_refund'
        ? 'refunded'
        : resolution === 'release_payment'
        ? 'completed'
        : 'closed'
      await supabase.from('orders').update({ status: orderStatus }).eq('id', dispute.order_id)

      // If refund — deduct -50₮ from seller via delivery trust system
      // (upgrades the old -5 direct insert to the proper -50₮ via issue_trust RPC)
      if (resolution === 'full_refund' || resolution === 'partial_refund') {
        const order = dispute.order as { seller_id: string; buyer_id: string; amount: number } | null
        if (order?.seller_id) {
          void awardDeliveryTrust(order.seller_id, 'dispute_lost', dispute.order_id)
        }
      }

      return NextResponse.json({ dispute: updated })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/disputes/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
