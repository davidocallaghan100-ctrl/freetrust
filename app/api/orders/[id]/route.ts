import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Only allow buyer or seller to view
    if (order.buyer_id !== user.id && order.seller_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch buyer and seller profiles
    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url').eq('id', order.buyer_id).single(),
      supabase.from('profiles').select('full_name, avatar_url').eq('id', order.seller_id).single(),
    ])

    return NextResponse.json({
      order: {
        ...order,
        buyer_name: buyerProfile?.full_name || 'Unknown',
        seller_name: sellerProfile?.full_name || 'Unknown',
        buyer_avatar: buyerProfile?.avatar_url,
        seller_avatar: sellerProfile?.avatar_url,
      }
    })
  } catch (err) {
    console.error('[Order GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const body = await req.json()
    const { action, delivery_notes, dispute_reason } = body

    // Seller actions
    if (user.id === order.seller_id) {
      if (action === 'mark_delivered') {
        if (order.status !== 'in_progress') {
          return NextResponse.json({ error: 'Can only mark in-progress orders as delivered' }, { status: 400 })
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'delivered',
            delivery_notes: delivery_notes || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
        }

        // Notify buyer
        await supabase.from('notifications').insert({
          user_id: order.buyer_id,
          type: 'order',
          title: 'Order delivered!',
          body: `"${order.item_title}" has been marked as delivered. Please review and release payment.`,
          link: `/orders/${id}`,
        })

        return NextResponse.json({ success: true, status: 'delivered' })
      }
    }

    // Buyer actions
    if (user.id === order.buyer_id) {
      if (action === 'release_payment') {
        if (order.status !== 'delivered') {
          return NextResponse.json({ error: 'Can only release payment for delivered orders' }, { status: 400 })
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'completed',
            escrow_released_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to release payment' }, { status: 500 })
        }

        // Issue trust reward to seller for completing a sale
        await supabase.rpc('issue_trust', {
          p_user_id: order.seller_id,
          p_amount: 10,
          p_type: 'sale_completed',
          p_ref: id,
          p_desc: `₮10 trust reward for completing sale: ${order.item_title}`,
        })

        // Notify seller
        await supabase.from('notifications').insert({
          user_id: order.seller_id,
          type: 'order',
          title: 'Payment released!',
          body: `Payment for "${order.item_title}" has been released. You earned ₮10 trust!`,
          link: `/orders/${id}`,
        })

        return NextResponse.json({ success: true, status: 'completed' })
      }

      if (action === 'raise_dispute') {
        if (order.status !== 'delivered' && order.status !== 'in_progress') {
          return NextResponse.json({ error: 'Can only dispute active orders' }, { status: 400 })
        }

        if (!dispute_reason) {
          return NextResponse.json({ error: 'Dispute reason is required' }, { status: 400 })
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'disputed',
            dispute_reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)

        if (updateError) {
          return NextResponse.json({ error: 'Failed to raise dispute' }, { status: 500 })
        }

        // Notify seller
        await supabase.from('notifications').insert({
          user_id: order.seller_id,
          type: 'order',
          title: 'Dispute raised',
          body: `A dispute has been raised for order "${order.item_title}". Our team will review.`,
          link: `/orders/${id}`,
        })

        return NextResponse.json({ success: true, status: 'disputed' })
      }
    }

    return NextResponse.json({ error: 'Invalid action or insufficient permissions' }, { status: 400 })
  } catch (err) {
    console.error('[Order PATCH] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
