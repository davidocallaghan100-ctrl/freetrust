import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const depositId = url.searchParams.get('deposit_id')
  const paypalOrderId = url.searchParams.get('token')
  if (!depositId) return NextResponse.redirect(new URL('/wallet?paypal_topup=error', req.url))

  const authClient = await createClient()
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) return NextResponse.redirect(new URL('/login?redirect=/wallet', req.url))

  const admin = createAdminClient()
  const { data: deposit } = await admin
    .from('money_deposits')
    .select('id, user_id, provider, paypal_order_id, status')
    .eq('id', depositId)
    .maybeSingle()

  if (!deposit || deposit.user_id !== user.id || deposit.provider !== 'paypal' || (paypalOrderId && deposit.paypal_order_id !== paypalOrderId)) {
    return NextResponse.redirect(new URL('/wallet?paypal_topup=error', req.url))
  }

  if (deposit.status === 'pending') {
    await admin.from('money_deposits').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', deposit.id).eq('status', 'pending')
  }
  return NextResponse.redirect(new URL('/wallet?paypal_topup=cancelled', req.url))
}
