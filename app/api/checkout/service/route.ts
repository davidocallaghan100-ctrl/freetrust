export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const SERVICE_FEE_RATE = 0.08 // 8%

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
    const { service_id, package_tier = 'Basic' } = body

    if (!service_id) {
      return NextResponse.json({ error: 'Missing service_id' }, { status: 400 })
    }

    // Fetch service listing from Supabase
    const { data: service, error: serviceError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', service_id)
      .eq('type', 'service')
      .single()

    if (serviceError || !service) {
      // Use a default price if listing not found (for demo/mock data)
      const mockPrice = 10000 // £100 in pence
      const feePence = Math.round(mockPrice * SERVICE_FEE_RATE)
      const payoutPence = mockPrice - feePence

      // Insert order record
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: user.id,
          seller_id: user.id, // fallback for mock
          listing_id: service_id,
          title: `Service ${service_id}`,
          amount: mockPrice,
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
            currency: 'eur',
            product_data: { name: `Service ${service_id}` },
            unit_amount: mockPrice,
          },
          quantity: 1,
        }],
        payment_intent_data: {
          // Escrow: hold funds until release_payment captures + transfers.
          capture_method: 'manual',
          metadata: {
            order_id: order.id,
            order_type: 'service',
            buyer_id: user.id,
            fee_pence: String(feePence),
            payout_pence: String(payoutPence),
          },
        },
        metadata: { order_id: order.id, order_type: 'service' },
        success_url: `${baseUrl}/orders/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/services/${service_id}`,
      })

      await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

      return NextResponse.json({ url: session.url, order_id: order.id })
    }

    const amountPence = Math.round((service.price || 100) * 100)
    const feePence = Math.round(amountPence * SERVICE_FEE_RATE)
    const payoutPence = amountPence - feePence

    // Insert order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: service.user_id || service.seller_id || user.id,
        listing_id: service.id,
        title: service.title,
        amount: amountPence,
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
          currency: 'eur',
          product_data: {
            name: service.title,
            description: `${package_tier} package — ${service.description || ''}`.slice(0, 500),
          },
          unit_amount: amountPence,
        },
        quantity: 1,
      }],
      payment_intent_data: {
        // Escrow: hold funds until release_payment captures + transfers.
        capture_method: 'manual',
        application_fee_amount: feePence,
        metadata: {
          order_id: order.id,
          order_type: 'service',
          item_id: service.id,
          buyer_id: user.id,
          seller_id: service.user_id || service.seller_id || '',
          fee_pence: String(feePence),
          payout_pence: String(payoutPence),
        },
      },
      metadata: { order_id: order.id, order_type: 'service' },
      success_url: `${baseUrl}/orders/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/services/${service.id}`,
    })

    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

    return NextResponse.json({ url: session.url, order_id: order.id })
  } catch (error) {
    console.error('[Checkout Service Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
