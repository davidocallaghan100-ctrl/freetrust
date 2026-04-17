import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { getTierByAmount, MIN_INVESTMENT_EUR, MAX_INVESTMENT_EUR } from '@/lib/founder/tiers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  const userClient = await createClient();
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user || !user.email) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: { amountEur?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const amountEur = body.amountEur;
  if (
    typeof amountEur !== 'number' ||
    !Number.isFinite(amountEur) ||
    amountEur < MIN_INVESTMENT_EUR ||
    amountEur > MAX_INVESTMENT_EUR
  ) {
    return NextResponse.json(
      { error: `Amount must be between €${MIN_INVESTMENT_EUR} and €${MAX_INVESTMENT_EUR}.` },
      { status: 400 }
    );
  }

  const tier = getTierByAmount(amountEur);

  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'https://freetrust.co';

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: {
              name: `FreeTrust ${tier.displayName} Founder`,
              description: `Lifetime ${tier.serviceFeePercent}% / ${tier.productFeePercent}% fees · +${tier.aiCreditsBonus.toLocaleString()} AI Credits · +${tier.trustBonus.toLocaleString()} TrustCoins · +${tier.monthlyAiCreditRefill}/mo refill for life`,
            },
            unit_amount: tier.priceCents,
          },
        },
      ],
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        type: 'founder_investment',
        user_id: user.id,
        tier_key: tier.key,
        tier_display_name: tier.displayName,
        investment_amount_eur: tier.priceEur.toString(),
        service_fee_bps: tier.serviceFeeBps.toString(),
        product_fee_bps: tier.productFeeBps.toString(),
        ai_credits_bonus: tier.aiCreditsBonus.toString(),
        trust_bonus: tier.trustBonus.toString(),
        monthly_refill: tier.monthlyAiCreditRefill.toString(),
      },
      success_url: `${origin}/founder/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/founder?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('Founder checkout creation failed:', err);
    return NextResponse.json({ error: 'checkout_creation_failed' }, { status: 500 });
  }
}
