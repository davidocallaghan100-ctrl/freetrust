type OrderRecord = Record<string, unknown>

function numericValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const number = Number(value)
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(number)) ? number : null
}

/** Rent & Share escrow rows use `in_person` and store `amount` in EUR. */
export function isRentShareOrder(order: OrderRecord): boolean {
  const type = String(order.type ?? '').toLowerCase()
  const normalisedType = type.replace(/[^a-z]/g, '')
  const deliveryType = String(order.delivery_type ?? '').toLowerCase()
  const notes = typeof order.notes === 'string' ? order.notes : ''
  return deliveryType === 'in_person'
    || normalisedType.includes('rentshare')
    || /^rent\s*&\s*share booking\b/i.test(notes)
}

/**
 * Return the buyer-facing order total in integer cents.
 *
 * Standard product/service checkout stores `orders.amount` in cents, with
 * discounted service checkouts recording the actual charge in
 * `payment_amount_cents`. Custom proposals and legacy Rent & Share rows store
 * `amount` in major EUR units. Unknown schemas intentionally return null
 * instead of rendering a plausible but incorrect amount.
 */
export function orderAmountCents(order: OrderRecord): number | null {
  const explicitAmountCents = numericValue(order.payment_amount_cents)
  if (explicitAmountCents !== null && explicitAmountCents >= 0) {
    return Math.round(explicitAmountCents)
  }

  const amount = numericValue(order.amount)
  if (amount === null || amount < 0) return null

  const type = String(order.type ?? '').toLowerCase()
  if (type === 'custom' || isRentShareOrder(order)) return Math.round(amount * 100)
  if (['product', 'service', 'gig', 'product_basket'].includes(type)) return Math.round(amount)
  return null
}

/** Match the release path: 5% product, 8% service/custom, 0% Rent & Share. */
export function sellerFeeCents(order: OrderRecord, grossCents: number): number {
  const gross = Number.isFinite(grossCents) ? Math.max(0, Math.round(grossCents)) : 0
  const recordedFee = numericValue(order.seller_fee_cents)
  if (recordedFee !== null && recordedFee >= 0) {
    return Math.min(gross, Math.max(0, Math.round(recordedFee)))
  }

  if (isRentShareOrder(order)) return 0
  const rate = String(order.type ?? '').toLowerCase() === 'product' ? 0.05 : 0.08
  return Math.min(gross, Math.round(gross * rate))
}

/** Use stored proceeds when present; otherwise mirror the release fee rule. */
export function sellerPayoutCents(order: OrderRecord, grossCents: number): number {
  const gross = Number.isFinite(grossCents) ? Math.max(0, Math.round(grossCents)) : 0
  const recordedPayout = numericValue(order.seller_payout_cents)
  if (recordedPayout !== null && recordedPayout >= 0) {
    return Math.min(gross, Math.max(0, Math.round(recordedPayout)))
  }
  return Math.max(0, gross - sellerFeeCents(order, gross))
}
