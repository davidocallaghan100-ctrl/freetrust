export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const webhookSecret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET ?? ''

type IdentityStatus = 'unverified' | 'pending' | 'verified' | 'failed'

function mapStripeStatus(session: Stripe.Identity.VerificationSession): IdentityStatus {
  if (session.status === 'verified') return 'verified'
  if (session.status === 'canceled') return 'failed'
  if (session.status === 'requires_input') return 'failed'
  return 'pending'
}

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 })
  }
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Stripe Identity webhook not configured' }, { status: 503 })
  }

  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Stripe Identity Webhook] Signature verification failed:', message)
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 })
  }

  try {
    if (event.type.startsWith('identity.verification_session.')) {
      const session = event.data.object as Stripe.Identity.VerificationSession
      await handleVerificationSession(session)
    } else {
      console.log('[Stripe Identity Webhook] Unhandled event type:', event.type)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Stripe Identity Webhook] Handler error for ${event.type}:`, message)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleVerificationSession(session: Stripe.Identity.VerificationSession) {
  const userId = session.metadata?.user_id
  if (!userId) {
    console.warn('[Stripe Identity Webhook] Missing user_id metadata for session:', session.id)
    return
  }

  const supabase = createAdminClient()
  const status = mapStripeStatus(session)
  const verifiedAt = status === 'verified'
    ? new Date((session.last_verification_report ? session.created : Math.floor(Date.now() / 1000)) * 1000).toISOString()
    : null

  const update: Record<string, string | null> = {
    stripe_verification_session_id: session.id,
    status,
  }
  if (verifiedAt) update.verified_at = verifiedAt

  const { error: upsertError } = await supabase
    .from('profile_verifications')
    .upsert({ user_id: userId, ...update }, { onConflict: 'user_id' })

  if (upsertError) {
    throw new Error(`profile_verifications upsert failed: ${upsertError.message}`)
  }

  if (status === 'verified') {
    const { error: bonusError } = await supabase.rpc('grant_verification_bonus', { user_id: userId })
    if (bonusError) {
      throw new Error(`grant_verification_bonus failed: ${bonusError.message}`)
    }
  }
}
