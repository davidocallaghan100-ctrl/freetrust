export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculateProductBasketTotals, eurFromCents } from '@/lib/checkoutConfig'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const PLATFORM_FEE_RATE = 0.05

type BasketRow = {
  id: string
  quantity: number
  listing_id: string | null
}

type ListingRow = {
  id: string
  title: string
  price: number | string | null
  price_eur: number | string | null
  currency: string | null
  currency_code: string | null
  seller_id: string | null
  status: string | null
  product_type: string | null
}

type SellerRow = {
  id: string
  stripe_account_id: string | null
  stripe_onboarded: boolean | null
  stripe_onboarding_complete: boolean | null
}

function priceToCents(listing: ListingRow): number | null {
  const source = listing.price_eur ?? listing.price
  const value = typeof source === 'number' ? source : typeof source === 'string' ? Number(source) : NaN
  if (!Number.isFinite(value) || value <= 0) return null
  return Math.round(value * 100)
}

export async function POST() {
  if (!stripe) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })

  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: basketRows, error: basketError } = await admin
      .from('basket_items')
      .select('id, quantity, listing_id')
      .eq('user_id', user.id)
      .eq('product_type', 'community')
      .not('listing_id', 'is', null)

    if (basketError) {
      console.error('[Basket Checkout] basket read failed', basketError)
      return NextResponse.json({ error: 'Could not read basket' }, { status: 500 })
    }

    const rows = (basketRows ?? []) as BasketRow[]
    if (rows.length === 0) return NextResponse.json({ error: 'No FreeTrust community products in basket' }, { status: 400 })

    const listingIds = rows.map(row => row.listing_id).filter(Boolean) as string[]
    const { data: listingsData, error: listingsError } = await admin
      .from('listings')
      .select('id, title, price, price_eur, currency, currency_code, seller_id, status, product_type')
      .in('id', listingIds)

    if (listingsError) {
      console.error('[Basket Checkout] listing read failed', listingsError)
      return NextResponse.json({ error: 'Could not verify products' }, { status: 500 })
    }

    const listings = new Map(((listingsData ?? []) as ListingRow[]).map(row => [row.id, row]))
    const missing = listingIds.filter(id => !listings.has(id))
    if (missing.length > 0) return NextResponse.json({ error: 'One or more basket products are no longer available' }, { status: 409 })

    const sellerIds = Array.from(new Set(Array.from(listings.values()).map(row => row.seller_id).filter(Boolean))) as string[]
    const { data: sellersData, error: sellersError } = await admin
      .from('profiles')
      .select('id, stripe_account_id, stripe_onboarded, stripe_onboarding_complete')
      .in('id', sellerIds)

    if (sellersError) {
      console.error('[Basket Checkout] seller read failed', sellersError)
      return NextResponse.json({ error: 'Could not verify sellers' }, { status: 500 })
    }

    const sellers = new Map(((sellersData ?? []) as SellerRow[]).map(row => [row.id, row]))
    const orderItems = [] as Array<{
      listing_id: string
      product_id: string
      seller_id: string
      title: string
      quantity: number
      unit_amount_cents: number
      subtotal_cents: number
      platform_fee_cents: number
      seller_payout_cents: number
      seller_payout_eur: number
    }>

    for (const basketRow of rows) {
      const listing = listings.get(basketRow.listing_id!)!
      if (listing.status !== 'active' || listing.product_type === 'service') {
        return NextResponse.json({ error: `${listing.title} is not available for basket checkout` }, { status: 409 })
      }
      if (!listing.seller_id || listing.seller_id === user.id) {
        return NextResponse.json({ error: `${listing.title} cannot be bought by this account` }, { status: 409 })
      }
      const seller = sellers.get(listing.seller_id)
      if (!seller?.stripe_account_id || (!seller.stripe_onboarded && !seller.stripe_onboarding_complete)) {
        return NextResponse.json({ error: `${listing.title} seller is not ready for Stripe checkout` }, { status: 409 })
      }
      const unit = priceToCents(listing)
      if (!unit) return NextResponse.json({ error: `${listing.title} has no valid price` }, { status: 409 })
      const quantity = Math.max(1, Math.min(99, Number(basketRow.quantity ?? 1)))
      const subtotal = unit * quantity
      const fee = Math.round(subtotal * PLATFORM_FEE_RATE)
      orderItems.push({
        listing_id: listing.id,
        product_id: listing.id,
        seller_id: listing.seller_id,
        title: listing.title,
        quantity,
        unit_amount_cents: unit,
        subtotal_cents: subtotal,
        platform_fee_cents: fee,
        seller_payout_cents: subtotal,
        seller_payout_eur: eurFromCents(subtotal),
      })
    }

    const subtotalCents = orderItems.reduce((sum, item) => sum + item.subtotal_cents, 0)
    const { platformFeeCents, totalCents } = calculateProductBasketTotals(subtotalCents)
    if (totalCents < 50) return NextResponse.json({ error: 'Basket total must be at least €0.50' }, { status: 400 })

    const { data: order, error: orderError } = await admin
      .from('orders')
      .insert({
        buyer_id: user.id,
        seller_id: null,
        listing_id: null,
        title: `Product basket (${orderItems.length} item${orderItems.length === 1 ? '' : 's'})`,
        amount: totalCents,
        currency: 'EUR',
        status: 'pending_escrow',
        notes: 'FreeTrust Phase 1C multi-item product basket',
        total_eur: eurFromCents(totalCents),
        freetrust_fee_eur: eurFromCents(platformFeeCents),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (orderError || !order) {
      console.error('[Basket Checkout] order insert failed', orderError)
      return NextResponse.json({ error: 'Could not create order' }, { status: 500 })
    }

    const { error: itemError } = await admin.from('order_items').insert(orderItems.map(item => ({
      order_id: order.id,
      buyer_id: user.id,
      ...item,
    })))

    if (itemError) {
      console.error('[Basket Checkout] order item insert failed', itemError)
      return NextResponse.json({ error: 'Could not create order items' }, { status: 500 })
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'eur',
      description: `FreeTrust product basket ${order.id}`,
      metadata: {
        type: 'product_basket',
        order_id: order.id,
        user_id: user.id,
        subtotal_cents: String(subtotalCents),
        platform_fee_cents: String(platformFeeCents),
        total_cents: String(totalCents),
        item_count: String(orderItems.length),
      },
      automatic_payment_methods: { enabled: true },
    })

    await admin
      .from('orders')
      .update({
        stripe_payment_intent: paymentIntent.id,
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    return NextResponse.json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      order_id: order.id,
      subtotal_cents: subtotalCents,
      platform_fee_cents: platformFeeCents,
      total_cents: totalCents,
      community_item_count: orderItems.length,
    })
  } catch (err) {
    console.error('[Basket Checkout] unexpected error', err)
    if (err instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: err.message }, { status: err.statusCode ?? 500 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
