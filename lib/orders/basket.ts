export type BasketOrderItem = Record<string, unknown>

export type BasketPayoutState = 'confirmed' | 'pending' | 'failed' | 'reconciliation_required'
const PAYPAL_FAILURE_STATUSES = new Set(['DENIED', 'FAILED', 'BLOCKED', 'RETURNED', 'CANCELED', 'CANCELLED', 'REVERSED', 'REFUNDED'])

function paypalPayoutSucceeded(status: unknown) {
  return typeof status === 'string' && status.toUpperCase() === 'SUCCESS'
}

function paypalPayoutFailed(status: unknown) {
  return typeof status === 'string' && PAYPAL_FAILURE_STATUSES.has(status.toUpperCase())
}

export function hasRecordedBasketPayout(gateway: unknown, item: BasketOrderItem): boolean {
  if (gateway === 'stripe') {
    return item.transfer_status === 'created'
      && typeof item.stripe_transfer_id === 'string'
      && item.stripe_transfer_id.length > 0
  }

  if (gateway === 'paypal') {
    return typeof item.paypal_payout_batch_id === 'string'
      && item.paypal_payout_batch_id.length > 0
      && paypalPayoutSucceeded(item.paypal_payout_status)
  }

  return false
}

export function getBasketPayoutState(gateway: unknown, item: BasketOrderItem): BasketPayoutState {
  if (hasRecordedBasketPayout(gateway, item)) return 'confirmed'
  if (gateway === 'paypal') {
    if (paypalPayoutFailed(item.paypal_payout_status)) return 'failed'
    if (typeof item.paypal_payout_batch_id === 'string' && item.paypal_payout_batch_id.length > 0) return 'pending'
  }
  return 'reconciliation_required'
}

export function canRefreshBasketPayout(gateway: unknown, item: BasketOrderItem) {
  return gateway === 'paypal'
    && getBasketPayoutState(gateway, item) === 'pending'
    && typeof item.paypal_payout_batch_id === 'string'
    && item.paypal_payout_batch_id.length > 0
}

/** Remove payment-provider references/errors before returning an item to either party. */
export function serializeBasketItem(gateway: unknown, item: BasketOrderItem) {
  const safeItem = { ...item }
  delete safeItem.stripe_transfer_id
  delete safeItem.transfer_status
  delete safeItem.transfer_error
  delete safeItem.paypal_payout_batch_id
  delete safeItem.paypal_payout_status
  delete safeItem.paypal_payout_error
  return {
    ...safeItem,
    payout_ready: hasRecordedBasketPayout(gateway, item),
    payout_state: getBasketPayoutState(gateway, item),
    payout_status_checkable: canRefreshBasketPayout(gateway, item),
  }
}

/**
 * Basket parent rows contain payment identifiers and aggregate totals across
 * sellers. Sellers receive only shared shipping/context fields and their own
 * item subtotal, never other sellers' order/payment data.
 */
export function serializeBasketOrderForViewer(
  order: BasketOrderItem,
  viewerId: string,
  visibleItems: BasketOrderItem[],
): BasketOrderItem {
  const isBuyer = order.buyer_id === viewerId
  const sellerItemsSubtotal = isBuyer ? 0 : visibleItems.reduce(
    (sum, item) => sum + Number(item.subtotal_cents ?? 0) + Number(item.buyer_fee_cents ?? 0),
    0,
  )

  return {
    id: order.id,
    buyer_id: order.buyer_id,
    seller_id: isBuyer ? order.seller_id : viewerId,
    type: order.type,
    title: order.title,
    status: order.status,
    currency: order.currency,
    payment_gateway: order.payment_gateway,
    created_at: order.created_at,
    updated_at: order.updated_at,
    notes: order.notes,
    delivery_address: order.delivery_address,
    amount: isBuyer ? order.amount : sellerItemsSubtotal,
  }
}
