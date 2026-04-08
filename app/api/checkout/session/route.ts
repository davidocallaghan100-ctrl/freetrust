import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

export async function GET(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items", "payment_intent"],
    });

    const lineItem = session.line_items?.data?.[0];
    const paymentIntent = session.payment_intent as Stripe.PaymentIntent | null;

    return NextResponse.json({
      itemName: lineItem?.description || "Order",
      amountTotal: session.amount_total || 0,
      platformFeeAmount: paymentIntent?.metadata?.platformFeeAmount
        ? parseInt(paymentIntent.metadata.platformFeeAmount, 10)
        : 0,
      platformFeeRate: paymentIntent?.metadata?.platformFeeRate
        ? parseFloat(paymentIntent.metadata.platformFeeRate)
        : 0,
      type: session.metadata?.type || "service",
      currency: session.currency || "usd",
    });
  } catch (error: unknown) {
    console.error("[Session Retrieve Error]", error);
    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

