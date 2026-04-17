import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_FOUNDER;

  if (!signature || !webhookSecret) {
    console.error('Missing stripe-signature or STRIPE_WEBHOOK_SECRET_FOUNDER');
    return NextResponse.json({ error: 'missing_signature_or_secret' }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'signature_verification_failed';
    console.error('Founder webhook signature verification failed:', message);
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 });
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true, skipped: 'not_paid' });
  }

  const meta = session.metadata ?? {};
  const userId = meta.user_id;
  const tierKey = meta.tier_key;
  const investmentAmount = meta.investment_amount_eur;
  const serviceFeeBps = meta.service_fee_bps;
  const productFeeBps = meta.product_fee_bps;
  const aiCreditsBonus = meta.ai_credits_bonus;
  const trustBonus = meta.trust_bonus;
  const monthlyRefill = meta.monthly_refill;

  if (!tierKey) {
    return NextResponse.json({ received: true, skipped: 'not_founder_session' });
  }

  if (
    !userId ||
    !investmentAmount ||
    !serviceFeeBps ||
    !productFeeBps ||
    !aiCreditsBonus ||
    !trustBonus ||
    !monthlyRefill
  ) {
    console.error('Missing required metadata on founder session:', session.id, meta);
    return NextResponse.json({ error: 'missing_metadata' }, { status: 400 });
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  const admin = createAdminClient();
  const { data, error } = await admin.rpc('grant_founder_investment', {
    p_user_id: userId,
    p_tier: tierKey,
    p_investment_amount_eur: parseInt(investmentAmount, 10),
    p_service_fee_bps: parseInt(serviceFeeBps, 10),
    p_product_fee_bps: parseInt(productFeeBps, 10),
    p_ai_credits_bonus: parseInt(aiCreditsBonus, 10),
    p_trust_bonus: parseInt(trustBonus, 10),
    p_monthly_refill: parseInt(monthlyRefill, 10),
    p_stripe_session_id: session.id,
    p_stripe_payment_intent_id: paymentIntentId,
  });

  if (error) {
    console.error('grant_founder_investment RPC error:', error);
    return NextResponse.json({ error: 'grant_failed', details: error.message }, { status: 500 });
  }

  return NextResponse.json({ received: true, result: data });
}
