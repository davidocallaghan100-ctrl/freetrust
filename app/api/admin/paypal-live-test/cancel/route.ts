import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireFreeTrustAdmin } from '@/lib/admin/access'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  const url = new URL(req.url)
  const runId = url.searchParams.get('run_id')
  const paypalOrderId = url.searchParams.get('token')
  if (!runId) return NextResponse.redirect(new URL('/admin/paypal-live-test?result=error&message=missing_run', req.url))

  const admin = createAdminClient()
  const { data: run } = await admin
    .from('paypal_live_test_runs')
    .select('id, created_by, paypal_order_id, status')
    .eq('id', runId)
    .maybeSingle()
  if (!run || run.created_by !== auth.user.id || (paypalOrderId && run.paypal_order_id !== paypalOrderId)) {
    return NextResponse.redirect(new URL('/admin/paypal-live-test?result=error&message=invalid_test_state', req.url))
  }

  if (run.status === 'pending') {
    await admin.from('paypal_live_test_runs').update({ status: 'cancelled' }).eq('id', run.id).eq('status', 'pending')
  }
  return NextResponse.redirect(new URL(`/admin/paypal-live-test?result=cancelled&run_id=${encodeURIComponent(run.id)}`, req.url))
}
