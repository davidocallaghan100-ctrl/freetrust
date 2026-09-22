import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPayPalPayoutBatch, isPayPalWalletAvailable } from '@/lib/paypal'

export const dynamic = 'force-dynamic'

const TERMINAL_FAILURES = new Set(['DENIED', 'FAILED', 'BLOCKED', 'RETURNED', 'CANCELED', 'CANCELLED'])

export async function GET(req: NextRequest) {
  if (!isPayPalWalletAvailable()) return NextResponse.json({ error: 'PayPal wallet payments are not currently available' }, { status: 503 })

  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const withdrawalId = new URL(req.url).searchParams.get('withdrawal_id')
  if (!withdrawalId) return NextResponse.json({ error: 'Missing withdrawal_id' }, { status: 400 })

  const admin = createAdminClient()
  const { data: withdrawal, error: withdrawalError } = await admin
    .from('wallet_withdrawals')
    .select('id, user_id, amount_cents, status, paypal_payout_batch_id, paypal_payout_status, error_message')
    .eq('id', withdrawalId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (withdrawalError || !withdrawal) return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 })

  if (withdrawal.status === 'processing' && withdrawal.paypal_payout_batch_id) {
    try {
      const batch = await getPayPalPayoutBatch(withdrawal.paypal_payout_batch_id)
      const batchStatus = (batch.batch_header?.batch_status ?? withdrawal.paypal_payout_status ?? 'PENDING').toUpperCase()
      const failed = TERMINAL_FAILURES.has(batchStatus)
      const completed = batchStatus === 'SUCCESS'
      const itemError = batch.items?.find(item => item.errors?.message)?.errors?.message ?? null
      await admin.from('wallet_withdrawals').update({
        status: completed ? 'completed' : failed ? 'failed' : 'processing',
        paypal_payout_status: batchStatus,
        error_message: failed ? (itemError ?? `PayPal payout status: ${batchStatus}`) : null,
        updated_at: new Date().toISOString(),
        completed_at: completed ? new Date().toISOString() : null,
      }).eq('id', withdrawal.id).eq('status', 'processing')
      return NextResponse.json({ withdrawal_id: withdrawal.id, amount_cents: withdrawal.amount_cents, status: completed ? 'completed' : failed ? 'failed' : 'processing', paypal_status: batchStatus })
    } catch (error) {
      console.error('[PayPal wallet withdrawal status]', error)
      return NextResponse.json({ withdrawal_id: withdrawal.id, amount_cents: withdrawal.amount_cents, status: withdrawal.status, paypal_status: withdrawal.paypal_payout_status, error: 'PayPal status is temporarily unavailable.' }, { status: 202 })
    }
  }

  return NextResponse.json({ withdrawal_id: withdrawal.id, amount_cents: withdrawal.amount_cents, status: withdrawal.status, paypal_status: withdrawal.paypal_payout_status, error: withdrawal.error_message })
}
