import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function redirect(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url))
}

function withPayPalState(path: string, state: 'error' | 'cancel') {
  return `${path}${path.includes('?') ? '&' : '?'}paypal=${state}`
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const orderId = url.searchParams.get('order_id')
  if (!orderId) return redirect(req, '/products?paypal=error')

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect(req, `/login?redirect=${encodeURIComponent(`/api/paypal/cancel?order_id=${orderId}`)}`)
  }

  const admin = createAdminClient()
  const { data: order, error: orderError } = await admin
    .from('orders')
    .select('id, buyer_id, listing_id, payment_gateway, paypal_order_id, status')
    .eq('id', orderId)
    .maybeSingle()

  if (orderError || !order || order.buyer_id !== user.id || order.payment_gateway !== 'paypal') {
    return redirect(req, '/products?paypal=error')
  }

  const paypalOrderId = url.searchParams.get('token')
  if (paypalOrderId && order.paypal_order_id && paypalOrderId !== order.paypal_order_id) {
    return redirect(req, '/products?paypal=error')
  }

  const returnPath = order.listing_id
    ? `/checkout?service=${encodeURIComponent(order.listing_id)}`
    : '/products'

  if (order.status === 'cancelled') return redirect(req, withPayPalState(returnPath, 'cancel'))
  if (order.status !== 'pending_escrow') return redirect(req, withPayPalState(returnPath, 'error'))

  const { error: reverseError } = await admin.rpc('reverse_service_discount', {
    p_order_id: order.id,
    p_reason: 'Buyer cancelled PayPal checkout before payment confirmation',
  })
  if (reverseError) {
    console.error('[PayPal Cancel] TrustCoin reversal failed', reverseError)
    return redirect(req, withPayPalState(returnPath, 'error'))
  }

  const { error: updateError } = await admin
    .from('orders')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', order.id)
    .eq('status', 'pending_escrow')

  if (updateError) {
    console.error('[PayPal Cancel] order update failed', updateError)
    return redirect(req, withPayPalState(returnPath, 'error'))
  }

  return redirect(req, withPayPalState(returnPath, 'cancel'))
}
