import { isRentShareOrder, orderAmountCents, sellerPayoutCents } from './amounts'

export type SellerProfileSummary = {
  id?: string
  full_name: string | null
  avatar_url: string | null
}

type SellerOrderRow = {
  id: string
  type: string | null
  listing_id: string | null
  title: string | null
  amount: number | string | null
  amount_pence?: number | null
  payment_amount_cents?: number | null
  seller_payout_cents?: number | null
  seller_fee_cents?: number | null
  delivery_type?: string | null
  notes?: string | null
  currency: string | null
  status: string
  created_at: string
  buyer_profile?: SellerProfileSummary | null
}

type SellerBasketItem = {
  id: string
  listing_id: string | null
  title: string
  subtotal_cents: number | null
  seller_payout_cents: number | null
  payout_ready: boolean
  delivery_status: string | null
  created_at?: string
  buyer_profile?: SellerProfileSummary | null
}

type SellerBasketOrder = {
  id: string
  status: string
  currency: string | null
  created_at: string
  items?: SellerBasketItem[]
}

export type SellerOrdersPayload = {
  orders?: SellerOrderRow[]
  basketOrders?: SellerBasketOrder[]
}

export type SellerSale = {
  id: string
  orderId: string
  listingId: string | null
  title: string
  status: string
  orderStatus: string
  createdAt: string
  currency: string
  grossCents: number
  payoutCents: number
  earnedCents: number
  payoutReady: boolean
  isBasketItem: boolean
  buyer: SellerProfileSummary | null
}

function cents(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isSafeInteger(Math.round(parsed))) return null
  return Math.round(parsed)
}

function requiredCents(value: unknown, message: string): number {
  const parsed = cents(value)
  if (parsed === null) throw new Error(message)
  return parsed
}

function currencyCode(value: string | null | undefined): string {
  const code = String(value || 'EUR').toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : 'EUR'
}

function validTimestamp(value: string | undefined, fallback?: string): string {
  const timestamp = value || fallback || ''
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new Error('A sale date could not be verified; analytics were not calculated.')
  }
  return timestamp
}

/**
 * Convert seller-facing marketplace rows into integer-cent sales. Ordinary
 * orders include service/product/custom/Rent & Share checkout; immediate-paid
 * product baskets are represented at item level because the parent has no seller.
 */
export function getSellerSales(payload: SellerOrdersPayload): SellerSale[] {
  const regularSales = (payload.orders ?? []).flatMap(order => {
    const type = String(order.type ?? '').toLowerCase()
    if (!['service', 'product', 'gig', 'custom'].includes(type) && !isRentShareOrder(order)) return []

    const grossCents = cents(order.amount_pence) ?? orderAmountCents(order)
    if (grossCents === null) {
      throw new Error('A marketplace order amount could not be verified; analytics were not calculated.')
    }
    const payoutCents = sellerPayoutCents(order, grossCents)
    const status = String(order.status ?? 'pending')
    const createdAt = validTimestamp(order.created_at)

    return [{
      id: order.id,
      orderId: order.id,
      listingId: order.listing_id,
      title: order.title || 'Marketplace order',
      status,
      orderStatus: status,
      createdAt,
      currency: currencyCode(order.currency),
      grossCents,
      payoutCents,
      earnedCents: status === 'completed' ? payoutCents : 0,
      payoutReady: status === 'completed',
      isBasketItem: false,
      buyer: order.buyer_profile ?? null,
    }]
  })

  const basketSales = (payload.basketOrders ?? []).flatMap(order => (order.items ?? []).map(item => {
    const grossCents = requiredCents(item.subtotal_cents, 'A product basket amount could not be verified; analytics were not calculated.')
    const payoutCents = requiredCents(item.seller_payout_cents, 'A product basket payout could not be verified; analytics were not calculated.')
    const payoutReady = item.payout_ready === true
    const status = item.delivery_status || order.status
    const createdAt = validTimestamp(item.created_at, order.created_at)
    const orderStatus = String(order.status ?? 'pending')
    const payoutRecorded = payoutReady && ['paid', 'completed'].includes(orderStatus.toLowerCase())

    return {
      id: item.id,
      orderId: order.id,
      listingId: item.listing_id,
      title: item.title || 'Product basket item',
      status,
      orderStatus,
      createdAt,
      currency: currencyCode(order.currency),
      grossCents,
      payoutCents,
      earnedCents: payoutRecorded ? payoutCents : 0,
      payoutReady: payoutRecorded,
      isBasketItem: true,
      buyer: item.buyer_profile ?? null,
    }
  }))

  return [...regularSales, ...basketSales]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}
