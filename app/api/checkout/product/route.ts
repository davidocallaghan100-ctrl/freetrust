export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const PRODUCT_FEE_RATE = 0.05 // 5%

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

    const body = await req.json().catch(() => null) as { product_id?: unknown } | null
    const product_id = body?.product_id

    if (typeof product_id !== 'string' || !product_id.trim()) {
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
      console.warn('[Checkout Product] listing not found:', product_id, productError)
      return NextResponse.json({ error: 'Product listing not found' }, { status: 404 })
    }

    const productRecord = product as Record<string, unknown>
    if (isListingUnavailable(productRecord)) {
      return NextResponse.json({ error: 'Product listing is not available for checkout' }, { status: 409 })
    }

    const sellerId = getListingSellerId(productRecord)
    if (!sellerId) {
      return NextResponse.json({ error: 'Product seller is not available for checkout' }, { status: 409 })
    }

    if (sellerId === user.id) {
      return NextResponse.json({ error: 'You cannot buy your own product' }, { status: 400 })
    }

    const amountPence = priceToPence(productRecord.price)
    if (!amountPence) {
      return NextResponse.json({ error: 'Product price is not available for checkout' }, { status: 409 })
    }

    const feePence = Math.round(amountPence * PRODUCT_FEE_RATE)
    const payoutPence = amountPence - feePence

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        listing_id: product.id,
        title: product.title,
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
            name: product.title,
            description: (product.description || '').slice(0, 500),
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
          order_type: 'product',
          item_id: product.id,
          buyer_id: user.id,
          seller_id: sellerId,
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
