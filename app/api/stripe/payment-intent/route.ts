export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

// POST /api/stripe/payment-intent
// Creates a PaymentIntent for use with the Payment Request Button (Apple Pay / Google Pay).
// Body: { amount_cents: number, currency?: string, description?: string, metadata?: Record<string, string> }
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })

  try {
    const authClient = await createClient()
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json() as {
      amount_cents: number
      currency?: string
      description?: string
      metadata?: Record<string, string>
    }

    const amountCents = Number(body.amount_cents)
    if (!amountCents || amountCents < 50) {
      return NextResponse.json({ error: 'Invalid amount (min 50 cents)' }, { status: 400 })
    }

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: (body.currency ?? 'eur').toLowerCase(),
      description: body.description ?? 'FreeTrust payment',
      metadata: {
        user_id: user.id,
        ...(body.metadata ?? {}),
      },
      // Apple Pay / Google Pay come through as 'card' payment methods
      payment_method_types: ['card'],
    })

    return NextResponse.json({ client_secret: intent.client_secret })
  } catch (err) {
    console.error('[POST /api/stripe/payment-intent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
