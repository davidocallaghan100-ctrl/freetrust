import { sendEmail } from '@/lib/email/send'

type BasketEmailItem = {
  seller_id: string | null
  title: string | null
  subtotal_cents: number | null
}

/** Send each basket seller one order notice, limited to their own item totals. */
export async function sendBasketSellerOrderEmails(
  orderId: string,
  currency: string,
  items: BasketEmailItem[],
): Promise<void> {
  const itemsBySeller = new Map<string, BasketEmailItem[]>()
  for (const item of items) {
    if (!item.seller_id) continue
    const sellerItems = itemsBySeller.get(item.seller_id) ?? []
    sellerItems.push(item)
    itemsBySeller.set(item.seller_id, sellerItems)
  }

  await Promise.all(Array.from(itemsBySeller, async ([sellerId, sellerItems]) => {
    const amountCents = sellerItems.reduce((total, item) => total + Math.max(0, Number(item.subtotal_cents ?? 0)), 0)
    if (amountCents <= 0) return

    const itemNames = sellerItems.map(item => item.title?.trim()).filter(Boolean)
    const fullTitle = itemNames.length ? `Product basket: ${itemNames.join(', ')}` : 'Product basket order'
    const orderTitle = fullTitle.length > 180 ? `${fullTitle.slice(0, 177)}…` : fullTitle
    const result = await sendEmail({
      type: 'order_placed',
      userId: sellerId,
      payload: {
        orderTitle,
        amount: amountCents / 100,
        orderId,
        recipientRole: 'seller',
        currency,
      },
    })

    if (!result.sent) {
      console.warn('[Basket order] Seller email not sent:', { orderId, sellerId, reason: result.reason })
    }
  }))
}
