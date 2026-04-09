import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const PRODUCT_FEE_RATE = 0.05 // 5%

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { product_id } = body

    if (!product_id) {
      return NextResponse.json({ error: 'Missing product_id' }, { status: 400 })
    }

    // Fetch product listing from Supabase
    const { data: product, error: productError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', product_id)
      .eq('type', 'product')
      .single()

    if (productError || !product) {
      // Fallback for mock data
      const mockPrice = 4900 // £49 in pence
      const feePence = Math.round(mockPrice * PRODUCT_FEE_RATE)
      const payoutPence = mockPrice - feePence

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: user.id,
          item_type: 'product',
          item_id: product_id,
          item_title: `Product ${product_id}`,
          amount_pence: mockPrice,
          platform_fee_pence: feePence,
          seller_payout_pence: payoutPence,
          status: 'pending_escrow',
        })
        .select()
        .single()

      if (orderError || !order) {
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
      }

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        // Auto-enables Apple Pay, Google Pay, Link etc based on buyer device
        customer_email: user.email,
        line_items: [{
          price_data: {
            currency: 'gbp',
            product_data: { name: `Product ${product_id}` },
            unit_amount: mockPrice,
          },
          quantity: 1,
        }],
        payment_intent_data: {
          metadata: {
            order_id: order.id,
            order_type: 'product',
            buyer_id: user.id,
            fee_pence: String(feePence),
            payout_pence: String(payoutPence),
          },
        },
        metadata: { order_id: order.id, order_type: 'product' },
        success_url: `${baseUrl}/orders/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/products/${product_id}`,
      })

      await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)
      return NextResponse.json({ url: session.url, order_id: order.id })
    }

    const amountPence = Math.round((product.price || 49) * 100)
    const feePence = Math.round(amountPence * PRODUCT_FEE_RATE)
    const payoutPence = amountPence - feePence

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: product.user_id || product.seller_id || user.id,
        item_type: 'product',
        item_id: product.id,
        item_title: product.title,
        amount_pence: amountPence,
        platform_fee_pence: feePence,
        seller_payout_pence: payoutPence,
        status: 'pending_escrow',
      })
      .select()
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Auto-enables Apple Pay, Google Pay, Link etc based on buyer device
      customer_email: user.email,
      line_items: [{
        price_data: {
          currency: 'gbp',
          product_data: {
            name: product.title,
            description: (product.description || '').slice(0, 500),
          },
          unit_amount: amountPence,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        application_fee_amount: feePence,
        metadata: {
          order_id: order.id,
          order_type: 'product',
          item_id: product.id,
          buyer_id: user.id,
          seller_id: product.user_id || product.seller_id || '',
          fee_pence: String(feePence),
          payout_pence: String(payoutPence),
        },
      },
      metadata: { order_id: order.id, order_type: 'product' },
      success_url: `${baseUrl}/orders/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/products/${product.id}`,
    })

    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

    return NextResponse.json({ url: session.url, order_id: order.id })
  } catch (error) {
    console.error('[Checkout Product Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
