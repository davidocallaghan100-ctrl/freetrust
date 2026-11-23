import assert from 'node:assert/strict'
import test from 'node:test'

const paypal = await import('../lib/paypal.ts')
const basket = await import('../lib/orders/basket.ts')
const amounts = await import('../lib/orders/amounts.ts')

const senderItemId = 'basket-order-item-123'

test('Earn helpers convert custom-order euros to cents and apply the normal seller fee', () => {
  const order = { type: 'custom', amount: 100 }
  const grossCents = amounts.orderAmountCents(order)

  assert.equal(grossCents, 10000)
  assert.equal(amounts.sellerPayoutCents(order, grossCents), 9200)
})

test('Earn treats Rent & Share amounts as euros and does not deduct a marketplace fee', () => {
  const order = { type: 'booking', delivery_type: 'in_person', amount: 500 }
  const grossCents = amounts.orderAmountCents(order)

  assert.equal(grossCents, 50000)
  assert.equal(amounts.sellerPayoutCents(order, grossCents), 50000)
})

test('basket sender item IDs are deterministic and satisfy PayPal length limits', () => {
  const first = paypal.getPayPalBasketSenderItemId('12345678-1234-1234-1234-123456789012', '87654321-4321-4321-4321-210987654321')
  const retry = paypal.getPayPalBasketSenderItemId('12345678-1234-1234-1234-123456789012', '87654321-4321-4321-4321-210987654321')
  const otherItem = paypal.getPayPalBasketSenderItemId('12345678-1234-1234-1234-123456789012', '87654321-4321-4321-4321-210987654322')

  assert.equal(first, retry)
  assert.notEqual(first, otherItem)
  assert.ok(first.length <= 63)
})

test('PayPal payout readiness requires the matching item and SUCCESS states', () => {
  const status = paypal.getPayPalPayoutStatus({
    batch_header: { batch_status: 'SUCCESS' },
    items: [{ sender_item_id: senderItemId, transaction_status: 'SUCCESS' }],
  }, senderItemId)

  assert.equal(status, 'SUCCESS')
  assert.equal(basket.hasRecordedBasketPayout('paypal', {
    paypal_payout_batch_id: 'batch-123',
    paypal_payout_status: status,
  }), true)
})

test('pending or processing PayPal payouts remain locked', () => {
  for (const status of ['PENDING', 'PROCESSING', 'SUBMITTED', 'IN_PROGRESS']) {
    assert.equal(basket.hasRecordedBasketPayout('paypal', {
      paypal_payout_batch_id: 'batch-123',
      paypal_payout_status: status,
    }), false)
  }
})

test('a successful batch without the matching successful item remains pending', () => {
  assert.equal(paypal.getPayPalPayoutStatus({
    batch_header: { batch_status: 'SUCCESS' },
    items: [{ sender_item_id: 'different-item', transaction_status: 'SUCCESS' }],
  }, senderItemId), 'PENDING')

  assert.equal(paypal.getPayPalPayoutStatus({
    batch_header: { batch_status: 'SUCCESS' },
    items: [],
  }, senderItemId), 'PENDING')
})

test('item failure or non-success status overrides a SUCCESS batch', () => {
  assert.equal(paypal.getPayPalPayoutStatus({
    batch_header: { batch_status: 'SUCCESS' },
    items: [{ sender_item_id: senderItemId, transaction_status: 'FAILED' }],
  }, senderItemId), 'FAILED')

  assert.equal(paypal.getPayPalPayoutStatus({
    batch_header: { batch_status: 'SUCCESS' },
    items: [{ sender_item_id: senderItemId, transaction_status: 'UNCLAIMED' }],
  }, senderItemId), 'UNCLAIMED')
})

test('PayPal payout serializer exposes safe state only and never provider IDs/errors', () => {
  const serialized = basket.serializeBasketItem('paypal', {
    id: 'item-123',
    paypal_payout_batch_id: 'private-batch-id',
    paypal_payout_status: 'PENDING',
    paypal_payout_error: 'private provider detail',
  })

  assert.equal(serialized.payout_ready, false)
  assert.equal(serialized.payout_state, 'pending')
  assert.equal(serialized.payout_status_checkable, true)
  assert.equal('paypal_payout_batch_id' in serialized, false)
  assert.equal('paypal_payout_status' in serialized, false)
  assert.equal('paypal_payout_error' in serialized, false)
})

test('failed PayPal payouts are locked for support reconciliation, not refreshed or re-submitted', () => {
  const item = { paypal_payout_batch_id: 'batch-123', paypal_payout_status: 'FAILED' }
  assert.equal(basket.getBasketPayoutState('paypal', item), 'failed')
  assert.equal(basket.canRefreshBasketPayout('paypal', item), false)
  assert.equal(basket.hasRecordedBasketPayout('paypal', item), false)
})
