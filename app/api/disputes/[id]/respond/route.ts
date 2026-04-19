export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activity/logActivity'

// POST /api/disputes/[id]/respond
// Either party (buyer or seller) adds a response step to the dispute thread.
// Body: { message: string, evidence_urls?: string[] }
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
    const { message, evidence_urls } = body

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Fetch the dispute with order info
    const { data: dispute } = await supabase
      .from('disputes')
      .select('*, order:orders!order_id(id, buyer_id, seller_id)')
      .eq('id', id)
      .single()

    if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
    if (dispute.status === 'resolved' || dispute.closed_at) {
      return NextResponse.json({ error: 'Dispute is already closed' }, { status: 422 })
    }

    const order = dispute.order as { id: string; buyer_id: string; seller_id: string } | null
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    // Verify user is party to this dispute
    const isBuyer  = order.buyer_id  === user.id
    const isSeller = order.seller_id === user.id
    if (!isBuyer && !isSeller) {
      return NextResponse.json({ error: 'Not your dispute' }, { status: 403 })
    }

    const actorRole = isBuyer ? 'buyer' : 'seller'
    const newStep = {
      actor_id:      user.id,
      actor_role:    actorRole,
      message:       message.trim(),
      evidence_urls: evidence_urls ?? [],
      timestamp:     new Date().toISOString(),
    }

    // Append to resolution_steps jsonb array
    const { data: updated, error } = await supabase
      .from('disputes')
      .update({
        resolution_steps: [...(dispute.resolution_steps ?? []), newStep],
        status: 'under_review',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Log to order activity feed
    void logActivity({
      orderId:   order.id,
      actorId:   user.id,
      actorRole: actorRole as 'buyer' | 'seller',
      eventType: 'dispute_raised',
      title:     `${actorRole === 'buyer' ? '🛒 Buyer' : '🏪 Seller'} responded to dispute`,
      body:      message.length > 100 ? message.slice(0, 100) + '…' : message,
    })

    return NextResponse.json({ dispute: updated }, { status: 200 })
  } catch (err) {
    console.error('[POST /api/disputes/[id]/respond]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
