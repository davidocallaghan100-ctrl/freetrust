export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPayPalOrder, getPayPalApprovalUrl, isPayPalAvailable } from '@/lib/paypal'

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
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => null) as {
      service_id?: unknown
      package_tier?: unknown
      trust_discount_tokens?: unknown
      gateway?: unknown
    } | null
    const service_id = body?.service_id
    const package_tier = typeof body?.package_tier === 'string' && body.package_tier.trim()
      ? body.package_tier.trim()
      : 'Basic'
    const gateway = body?.gateway === 'paypal' ? 'paypal' : 'stripe'
    const requestedTrustTokens = body?.trust_discount_tokens == null
      ? 0
      : Number(body.trust_discount_tokens)

    if (typeof service_id !== 'string' || !service_id.trim()) {
      return NextResponse.json({ error: 'Missing service_id' }, { status: 400 })
    }

    // Fetch service listing from Supabase
    const { data: service, error: serviceError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', service_id)
      .eq('product_type', 'service')
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

    const amountPence = priceToPence(serviceRecord.price_eur ?? serviceRecord.price)
    if (!amountPence) {
      return NextResponse.json({ error: 'Service price is not available for checkout' }, { status: 409 })
    }

    if (!Number.isInteger(requestedTrustTokens) || requestedTrustTokens < 0 || (requestedTrustTokens > 0 && requestedTrustTokens % 100 !== 0)) {
      return NextResponse.json({ error: 'TrustCoin discounts must be whole €1 increments (₮100 = €1)' }, { status: 400 })
    }

    // Never allow the TrustCoin discount to remove the entire Stripe charge.
    // The server recomputes this cap; the client is only a convenience display.
    const maxTrustTokens = Math.floor(Math.max(0, amountPence - 50) / 100) * 100
    if (requestedTrustTokens > maxTrustTokens) {
      return NextResponse.json({ error: 'That TrustCoin discount is larger than the service amount allows.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const discountPence = requestedTrustTokens
    const chargedAmountPence = amountPence - discountPence
    const feePence = Math.round(chargedAmountPence * SERVICE_FEE_RATE)
    const payoutPence = chargedAmountPence - feePence

    if (gateway === 'paypal') {
      const { data: sellerProfile } = await admin
        .from('profiles')
        .select('paypal_email')
        .eq('id', sellerId)
        .maybeSingle()
      if (typeof sellerProfile?.paypal_email !== 'string' || !sellerProfile.paypal_email.trim()) {
        return NextResponse.json({ error: 'This seller has not configured a PayPal payout email yet.', code: 'seller_no_paypal_email' }, { status: 409 })
      }
    }

    // Insert order record
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: sellerId,
        listing_id: service.id,
        title: service.title,
        type: 'service',
        amount: amountPence,
        gross_amount: amountPence,
        payment_gateway: gateway,
        payment_amount_cents: chargedAmountPence,
        status: 'pending_escrow',
      })
      .select()
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }

    // Reserve the TrustCoin before creating Stripe Checkout so the final
    // amount and the debit are linked to this order. The RPC is atomic and
    // idempotent for retries of the same order.
    if (requestedTrustTokens > 0) {
      const { error: reserveError } = await admin.rpc('reserve_service_discount', {
        p_order_id: order.id,
        p_user_id: user.id,
        p_amount_tokens: requestedTrustTokens,
      })

      if (reserveError) {
        await admin
          .from('orders')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', order.id)

        if ((reserveError.message ?? '').includes('insufficient_funds')) {
          return NextResponse.json({ error: 'You do not have enough TrustCoin for that discount.', code: 'insufficient_funds' }, { status: 402 })
        }

        console.error('[Checkout Service] TrustCoin reservation failed:', reserveError)
        return NextResponse.json({ error: 'Could not apply the TrustCoin discount. Please try again.' }, { status: 500 })
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

    if (gateway === 'paypal') {
      if (!isPayPalAvailable()) {
        if (requestedTrustTokens > 0) {
          await admin.rpc('reverse_service_discount', {
            p_order_id: order.id,
            p_reason: 'PayPal is not configured',
          })
        }
        await admin
          .from('orders')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', order.id)
        return NextResponse.json({ error: 'PayPal is not currently available' }, { status: 503 })
      }

      try {
        const paypalOrder = await createPayPalOrder({
          referenceId: order.id,
          customId: order.id,
          description: `${service.title} — ${package_tier}`,
          amountCents: chargedAmountPence,
          returnUrl: `${baseUrl}/api/paypal/return?order_id=${encodeURIComponent(order.id)}`,
          cancelUrl: `${baseUrl}/api/paypal/cancel?order_id=${encodeURIComponent(order.id)}`,
          intent: 'AUTHORIZE',
        })
        const approvalUrl = getPayPalApprovalUrl(paypalOrder)
        if (!paypalOrder.id || !approvalUrl) throw new Error('PayPal did not return an approval URL')

        const { error: paypalOrderUpdateError } = await admin
          .from('orders')
          .update({ paypal_order_id: paypalOrder.id, paypal_intent: 'AUTHORIZE', updated_at: new Date().toISOString() })
          .eq('id', order.id)
        if (paypalOrderUpdateError) throw paypalOrderUpdateError

        return NextResponse.json({ url: approvalUrl, order_id: order.id, gateway: 'paypal' })
      } catch (paypalError) {
        if (requestedTrustTokens > 0) {
          await admin.rpc('reverse_service_discount', {
            p_order_id: order.id,
            p_reason: 'PayPal order creation failed',
          })
        }
        await admin
          .from('orders')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', order.id)
        throw paypalError
      }
    }

    if (!stripe) {
      if (requestedTrustTokens > 0) {
        await admin.rpc('reverse_service_discount', {
          p_order_id: order.id,
          p_reason: 'Stripe is not configured',
        })
      }
      await admin
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', order.id)
      return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
    }

    let session: Stripe.Checkout.Session
    try {
      session = await stripe.checkout.sessions.create({
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
            unit_amount: chargedAmountPence,
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
            trust_discount_tokens: String(requestedTrustTokens),
          },
        },
        metadata: {
          order_id: order.id,
          order_type: 'service',
          trust_discount_tokens: String(requestedTrustTokens),
        },
        success_url: `${baseUrl}/orders/${order.id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/services/${service.id}`,
      })
    } catch (error) {
      if (requestedTrustTokens > 0) {
        const { error: reverseError } = await admin.rpc('reverse_service_discount', {
          p_order_id: order.id,
          p_reason: 'Stripe Checkout session creation failed',
        })
        if (reverseError) console.error('[Checkout Service] TrustCoin reversal failed:', reverseError)
      }
      await admin
        .from('orders')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', order.id)
      throw error
    }

    await supabase.from('orders').update({ stripe_session_id: session.id }).eq('id', order.id)

    return NextResponse.json({ url: session.url, order_id: order.id })
  } catch (error) {
    console.error('[Checkout Service Error]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
