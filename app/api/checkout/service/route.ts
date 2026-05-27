export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const SERVICE_FEE_RATE = 0.08 // 8%

function getListingSellerId(listing: Record<string, unknown>): string | null {
  const sellerId = listing.user_id ?? listing.seller_id
  return typeof sellerId === 'string' && sellerId.trim() ? sellerId : null
}

function isListingUnavailable(listing: Record<string, unknown>): boolean {
  if (listing.deleted_at) return true
  if (listing.is_active === false || listing.active === false) return true
  if (typeof listing.status === 'string' && ['archived', 'deleted', 'inactive', 'draft', 'paused'].includes(listing.status.toLowerCase())) {
    return true
  }
  return false
}

function priceToPence(price: unknown): number | null {
  const value = typeof price === 'number' ? price : typeof price === 'string' ? Number(price) : NaN
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

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

    const body = await req.json().catch(() => null) as { service_id?: unknown; package_tier?: unknown } | null
    const service_id = body?.service_id
    const package_tier = typeof body?.package_tier === 'string' && body.package_tier.trim()
      ? body.package_tier.trim()
      : 'Basic'

    if (typeof service_id !== 'string' || !service_id.trim()) {
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
      console.warn('[Checkout Service] listing not found:', service_id, serviceError)
      return NextResponse.json({ error: 'Service listing not found' }, { status: 404 })
    }

    const serviceRecord = service as Record<string, unknown>
    if (isListingUnavailable(serviceRecord)) {
      return NextResponse.json({ error: 'Service listing is not available for checkout' }, { status: 409 })
    }

    const sellerId = getListingSellerId(serviceRecord)
    if (!sellerId) {
      return NextResponse.json({ error: 'Service seller is not available for checkout' }, { status: 409 })
    }

    if (sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot buy your own service' }, { status: 400 })
    }

    const amountPence = priceToPence(serviceRecord.price)
    if (!amountPence) {
      return NextResponse.json({ error: 'Service price is not available for checkout' }, { status: 409 })
    }

    const feePence = Math.round(amountPence * SERVICE_FEE_RATE)
    const payoutPence = amountPence - feePence

    // Insert order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
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
          seller_id: sellerId,
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
