// Shared EUR wallet balance calculator — mirrors the inline calc in
// app/api/wallet/transfer/route.ts so booking check-in (and any future
// money-movement flow) can validate sufficient funds the same way the
// rest of the app does.

import { createAdminClient } from '@/lib/supabase/admin'

export async function getEurAvailableBalance(userId: string): Promise<number> {
  const admin = createAdminClient()

  const [depositsRes, earnedRes, spentRes, sentRes, recvRes] = await Promise.all([
    admin.from('money_deposits')
      .select('amount_cents')
      .eq('user_id', userId)
      .eq('status', 'completed'),
    admin.from('orders')
      .select('amount')
      .eq('seller_id', userId)
      .eq('status', 'completed')
      .neq('delivery_type', 'deposit'),
    admin.from('orders')
      .select('amount')
      .eq('buyer_id', userId)
      .eq('status', 'completed')
      .neq('delivery_type', 'deposit'),
    admin.from('wallet_transfers')
      .select('amount')
      .eq('sender_id', userId)
      .eq('currency', 'EUR')
      .eq('status', 'completed'),
    admin.from('wallet_transfers')
      .select('amount')
      .eq('recipient_id', userId)
      .eq('currency', 'EUR')
      .eq('status', 'completed'),
  ])

  const queryErrors = [depositsRes, earnedRes, spentRes, sentRes, recvRes]
    .map(result => result.error)
    .filter(Boolean)
  if (queryErrors.length > 0) {
    console.error('[rent-share] wallet balance query failed:', queryErrors)
    throw new Error('Could not verify wallet balance')
  }

  const totalDeposited = (depositsRes.data ?? []).reduce((s, d) => s + (Number((d as { amount_cents: number }).amount_cents) / 100), 0)
  const totalEarned = (earnedRes.data ?? []).reduce((s, o) => s + Number((o as { amount: number }).amount ?? 0), 0)
  const totalSpent = (spentRes.data ?? []).reduce((s, o) => s + Number((o as { amount: number }).amount ?? 0), 0)
  const totalSent = (sentRes.data ?? []).reduce((s, t) => s + Number((t as { amount: number }).amount), 0)
  const totalReceived = (recvRes.data ?? []).reduce((s, t) => s + Number((t as { amount: number }).amount), 0)

  return totalDeposited + totalEarned - totalSpent - totalSent + totalReceived
}
