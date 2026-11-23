import { orderAmountCents } from '@/lib/orders/amounts'

type OrderRecord = Record<string, unknown>

const SUMMARY_FIELDS = [
  'id',
  'listing_id',
  'buyer_id',
  'seller_id',
  'type',
  'title',
  'status',
  'amount',
  'payment_amount_cents',
  'seller_payout_cents',
  'seller_fee_cents',
  'buyer_fee_cents',
  'platform_fee_cents',
  'item_subtotal_cents',
  'currency',
  'payment_gateway',
  'delivery_type',
  'notes',
  'created_at',
  'updated_at',
] as const

const DETAIL_FIELDS = [
  'delivery_type',
  'delivery_address',
  'delivery_lat',
  'delivery_lng',
  'delivery_notes',
  'expected_delivery_at',
  'dispute_reason',
  'escrow_released_at',
  'status_history',
] as const

function pickFields(order: OrderRecord, fields: readonly string[]) {
  const output: OrderRecord = {}
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(order, field) && order[field] !== undefined) {
      output[field] = order[field]
    }
  }
  return output
}

/** Minimal order-list response; processor identifiers never leave the server. */
export function serializeOrderSummary(order: OrderRecord) {
  return {
    ...pickFields(order, SUMMARY_FIELDS),
    amount_pence: orderAmountCents(order),
  }
}

/** Buyer/seller detail response, with fulfillment fields but no payment IDs. */
export function serializeOrderDetail(order: OrderRecord) {
  return {
    ...serializeOrderSummary(order),
    ...pickFields(order, DETAIL_FIELDS),
  }
}
