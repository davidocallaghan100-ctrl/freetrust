export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

// POST /api/stripe/topup — create a Stripe checkout session to add funds
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const amountCents = Number(body.amount_cents)

    if (!amountCents || amountCents < 100 || amountCents > 1000000) {
      return NextResponse.json({ error: 'Invalid amount (min €1, max €10,000)' }, { status: 400 })
    }

    // Get profile for name
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()

    // Create a pending deposit record
    const { data: deposit, error: dbError } = await supabase
      .from('money_deposits')
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        currency: 'eur',
        status: 'pending',
      })
      .select('id')
      .single()

    if (dbError || !deposit) {
      console.error('[topup] DB insert error:', dbError)
      return NextResponse.json({ error: 'Failed to create deposit record' }, { status: 500 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'FreeTrust Wallet Top-up',
              description: `Add funds to your FreeTrust wallet (${profile?.full_name ?? user.email})`,
              images: ['https://davidocallaghan100829028694.adaptive.ai/cdn/freetrust-logo-v1.png'],
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'wallet_topup',
        user_id: user.id,
        deposit_id: deposit.id,
        amount_cents: amountCents.toString(),
      },
      customer_email: user.email ?? undefined,
      success_url: `${BASE_URL}/wallet?topup=success&amount=${amountCents}`,
      cancel_url: `${BASE_URL}/wallet?topup=cancelled`,
    })

    // Save session ID to deposit record
    await supabase
      .from('money_deposits')
      .update({ stripe_session_id: session.id })
      .eq('id', deposit.id)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[POST /api/stripe/topup]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
