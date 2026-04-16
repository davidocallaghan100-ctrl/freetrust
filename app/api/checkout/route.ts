export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

// Stripe is optional — checkout routes return 503 if key not configured
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

const PLATFORM_FEES = {
  service: 0.08,
  product: 0.05,
};

export async function POST(req: NextRequest) {
  // Auth guard — must be logged in to initiate checkout
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stripe) {
    return NextResponse.json({ error: "Payments not yet configured" }, { status: 503 });
  }
  try {
    const body = await req.json();
    const {
      itemName,
      itemDescription,
      amountInCents,
      type,
      successUrl,
      cancelUrl,
      sellerId,
      buyerEmail,
    } = body;

    if (!itemName || !amountInCents || !type || !sellerId) {
      return NextResponse.json(
        { error: "Missing required fields: itemName, amountInCents, type, sellerId" },
        { status: 400 }
      );
    }

    if (!["service", "product"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be 'service' or 'product'." },
        { status: 400 }
      );
    }

    if (typeof amountInCents !== "number" || amountInCents < 50) {
      return NextResponse.json(
        { error: "amountInCents must be a number and at least 50 (i.e. $0.50)." },
        { status: 400 }
      );
    }

    const feeRate = PLATFORM_FEES[type as keyof typeof PLATFORM_FEES];
    const platformFeeAmount = Math.round(amountInCents * feeRate);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Omitting payment_method_types lets Stripe auto-enable all eligible methods
      // including Apple Pay, Google Pay, Link, and card — based on buyer's device/browser
      customer_email: buyerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: itemName,
              description: itemDescription || undefined,
              metadata: {
                type,
                sellerId,
              },
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        // True escrow: hold the funds on FreeTrust's platform account
        // in `requires_capture` state. The release_payment action on
        // the order page calls stripe.paymentIntents.capture() +
        // stripe.transfers.create() when the buyer confirms the work
        // is complete. Dispute path cancels the intent, refunding
        // the hold with zero platform or seller balance impact.
        capture_method: "manual",
        // Fee remains taken at capture via application_fee_amount,
        // but the destination-charge auto-transfer was moved into
        // the release_payment action in app/api/orders/[id]/route.ts
        // so the money doesn't leave the platform until release.
        // transfer_data REMOVED intentionally.
        application_fee_amount: platformFeeAmount,
        metadata: {
          type,
          sellerId,
          escrow: "true",
          captureMethod: "manual",
          platformFeeRate: String(feeRate),
          platformFeeAmount: String(platformFeeAmount),
          originalAmount: String(amountInCents),
        },
      },
      metadata: {
        type,
        sellerId,
        escrow: "true",
      },
      success_url: successUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/checkout/cancel`,
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      platformFeeAmount,
      platformFeeRate: feeRate,
    });
  } catch (error: unknown) {
    console.error("[Stripe Checkout Error]", error);
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
