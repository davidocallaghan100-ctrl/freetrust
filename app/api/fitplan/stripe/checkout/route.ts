export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { getFitPlanTopupPackage } from '@/lib/fitplan/constants'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' }) : null

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as { packageId?: string } | null
  const pkg = getFitPlanTopupPackage(body?.packageId)
  if (!pkg) return NextResponse.json({ error: 'Unknown FitPlan package' }, { status: 400 })
  const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://freetrust.co'
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: user.email ?? undefined,
    success_url: `${origin}/fitplan/dashboard?topup=success`,
    cancel_url: `${origin}/fitplan/dashboard?topup=cancelled`,
    line_items: [{ price_data: { currency: 'eur', product_data: { name: `${pkg.label} — ₮${pkg.trust} FitPlan Trust Coins` }, unit_amount: pkg.amountCents }, quantity: 1 }],
    metadata: { type: 'fitplan_topup', reason: 'fitplan_topup', user_id: user.id, package_id: pkg.id, trust_amount: String(pkg.trust), amount_cents: String(pkg.amountCents) },
    payment_intent_data: { metadata: { type: 'fitplan_topup', reason: 'fitplan_topup', user_id: user.id, package_id: pkg.id, trust_amount: String(pkg.trust), amount_cents: String(pkg.amountCents) } },
  })
  return NextResponse.json({ url: session.url })
}
