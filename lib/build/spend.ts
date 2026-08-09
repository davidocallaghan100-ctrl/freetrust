// Build — AI architecture design studio: Trust Coin spend helper.
//
// Thin wrapper around the existing `spend_trust` RPC (see
// app/api/trust/spend/route.ts for the canonical pattern/comments this
// mirrors). Never writes to trust_balances/trust_ledger directly.

import { createAdminClient } from '@/lib/supabase/admin'

export interface SpendResult {
  ok: true
  newBalance: number | null
}

export interface SpendInsufficientFunds {
  ok: false
  code: 'insufficient_funds'
  balance: number
  required: number
}

export interface SpendError {
  ok: false
  code: 'error'
  message: string
}

export async function spendTrustCoins(
  userId: string,
  amount: number,
  type: string,
  description: string
): Promise<SpendResult | SpendInsufficientFunds | SpendError> {
  const admin = createAdminClient()

  const { data: newBalance, error: rpcError } = await admin.rpc('spend_trust', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_desc: description,
  })

  if (rpcError) {
    const msg = rpcError.message ?? ''
    if (msg.includes('insufficient_funds')) {
      const { data: bal } = await admin
        .from('trust_balances')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle()
      return { ok: false, code: 'insufficient_funds', balance: bal?.balance ?? 0, required: amount }
    }
    console.error('[Build] spend_trust RPC failed:', { message: rpcError.message, code: rpcError.code, type })
    return { ok: false, code: 'error', message: rpcError.message || 'Could not debit trust balance' }
  }

  return { ok: true, newBalance: typeof newBalance === 'number' ? newBalance : null }
}
