import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(req: NextRequest) {
  if (!stripe) {
    return NextResponse.json({ error: "Payments not configured" }, { status: 503 });
  }
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe Webhook] Signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentFailed(paymentIntent);
        break;
      }

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        await handleTransferCreated(transfer);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log("[Escrow] Checkout completed:", {
    sessionId: session.id,
    type: session.metadata?.type,
    sellerId: session.metadata?.sellerId,
    escrow: session.metadata?.escrow,
    amountTotal: session.amount_total,
    paymentIntent: session.payment_intent,
  });

  // TODO: Persist escrow record to your database here.
  // Example fields to store:
  //   - session.id
  //   - session.payment_intent (PaymentIntent ID)
  //   - session.metadata.sellerId
  //   - session.metadata.type ("service" | "product")
  //   - session.amount_total
  //   - status: "escrowed"
  //   - createdAt: new Date()
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log("[Escrow] PaymentIntent succeeded:", {
    id: paymentIntent.id,
    amount: paymentIntent.amount,
    type: paymentIntent.metadata?.type,
    sellerId: paymentIntent.metadata?.sellerId,
    platformFeeAmount: paymentIntent.metadata?.platformFeeAmount,
    platformFeeRate: paymentIntent.metadata?.platformFeeRate,
  });

  // TODO: Update escrow status in your DB to "funds_held".
  // Funds are held on the platform until service/product is confirmed delivered.
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  console.log("[Escrow] PaymentIntent failed:", {
    id: paymentIntent.id,
    sellerId: paymentIntent.metadata?.sellerId,
    lastPaymentError: paymentIntent.last_payment_error?.message,
  });

  // TODO: Update escrow status in your DB to "failed".
  // Notify buyer of failure.
}

async function handleTransferCreated(transfer: Stripe.Transfer) {
  console.log("[Escrow] Transfer to seller created:", {
    id: transfer.id,
    amount: transfer.amount,
    destination: transfer.destination,
  });

  // TODO: Update escrow status in your DB to "released".
  // Notify buyer and seller that funds have been released.
}

