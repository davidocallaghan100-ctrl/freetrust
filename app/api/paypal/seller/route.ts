import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function validEmail(value: unknown) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await createAdminClient()
    .from('profiles')
    .select('paypal_email')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) return NextResponse.json({ error: 'Could not load PayPal payout details' }, { status: 500 })
  return NextResponse.json({ paypal_email: profile?.paypal_email ?? '' })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { paypal_email?: unknown } | null
  const paypalEmail = typeof body?.paypal_email === 'string' ? body.paypal_email.trim().toLowerCase() : ''
  if (!validEmail(paypalEmail)) {
    return NextResponse.json({ error: 'Enter a valid PayPal email address' }, { status: 400 })
  }

  const { error: updateError } = await createAdminClient()
    .from('profiles')
    .update({ paypal_email: paypalEmail, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (updateError) {
    console.error('[PayPal Seller] profile update failed', updateError)
    return NextResponse.json({ error: 'Could not save PayPal payout details' }, { status: 500 })
  }
  return NextResponse.json({ paypal_email: paypalEmail })
}
