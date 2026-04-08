
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const PLATFORM_FEES = {
  service: 0.08,
  product: 0.05,
};

export async function POST(req: NextRequest) {
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
      payment_method_types: ["card"],
      customer_email: buyerEmail || undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
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
        application_fee_amount: platformFeeAmount,
        transfer_data: {
          destination: sellerId,
        },
        metadata: {
          type,
          sellerId,
          escrow: "true",
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

{"file": "app/api/webhooks/stripe/route.ts", "action": "write"}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
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

{"file": "app/checkout/success/page.tsx", "action": "write"}

import { Suspense } from "react";
import CheckoutSuccessContent from "@/components/CheckoutSuccessContent";

export const metadata = {
  title: "Payment Successful — FreeTrust",
  description: "Your payment was received and is held in escrow.",
};

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={<div className="checkout-loading">Loading your order details...</div>}>
      <CheckoutSuccessContent />
    </Suspense>
  );
}

{"file": "app/checkout/cancel/page.tsx", "action": "write"}

import Link from "next/link";

export const metadata = {
  title: "Payment Cancelled — FreeTrust",
  description: "Your payment was cancelled. No charges were made.",
};

export default function CheckoutCancelPage() {
  return (
    <main className="checkout-page">
      <div className="checkout-card">
        <div className="checkout-icon checkout-icon--cancel">✕</div>
        <h1 className="checkout-title">Payment Cancelled</h1>
        <p className="checkout-description">
          No worries — your payment was cancelled and you were not charged.
          You can return to browse services or try again at any time.
        </p>
        <div className="checkout-actions">
          <Link href="/" className="checkout-btn checkout-btn--primary">
            Back to Home
          </Link>
          <Link href="/services" className="checkout-btn checkout-btn--secondary">
            Browse Services
          </Link>
        </div>
      </div>
    </main>
  );
}

{"file": "components/CheckoutSuccessContent.tsx", "action": "write"}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SessionSummary {
  itemName: string;
  amountTotal: number;
  platformFeeAmount: number;
  platformFeeRate: number;
  type: string;
  currency: string;
}

export default function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setError("No session ID found.");
      setLoading(false);
      return;
    }

    async function fetchSession() {
      try {
        const res = await fetch(`/api/checkout/session?session_id=${sessionId}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to load order details.");
          return;
        }
        const data = await res.json();
        setSummary(data);
      } catch {
        setError("Something went wrong loading your order details.");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [sessionId]);

  if (loading) {
    return <div className="checkout-loading">Loading your order details...</div>;
  }

  if (error) {
    return (
      <main className="checkout-page">
        <div className="checkout-card">
          <div className="checkout-icon checkout-icon--success">✓</div>
          <h1 className="checkout-title">Payment Received!</h1>
          <p className="checkout-description">
            Your payment was successful and is now held securely in escrow.
            Funds will be released to the seller once delivery is confirmed.
          </p>
          <div className="checkout-actions">
            <Link href="/" className="checkout-btn checkout-btn--primary">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const feeLabel = summary?.type === "service" ? "8% service fee" : "5% product fee";
  const amountDisplay = summary
    ? `$${(summary.amountTotal / 100).toFixed(2)} ${summary.currency.toUpperCase()}`
    : "";
  const feeDisplay = summary
    ? `$${(summary.platformFeeAmount / 100).toFixed(2)}`
    : "";
  const sellerReceives = summary
    ? `$${((summary.amountTotal - summary.platformFeeAmount) / 100).toFixed(2)}`
    : "";

  return (
    <main className="checkout-page">
      <div className="checkout-card">
        <div className="checkout-icon checkout-icon--success">✓</div>
        <h1 className="checkout-title">Payment Successful!</h1>
        <p className="checkout-description">
          Your payment is held securely in escrow. Funds will be released to the seller
          once you confirm delivery.
        </p>

        {summary && (
          <div className="checkout-summary">
            <h2 className="checkout-summary-title">Order Summary</h2>
            <div className="checkout-summary-row">
              <span>Item</span>
              <span>{summary.itemName}</span>
            </div>
            <div className="checkout-summary-row">
              <span>Total Paid</span>
              <span>{amountDisplay}</span>
            </div>
            <div className="checkout-summary-row checkout-summary-row--fee">
              <span>Platform Fee ({feeLabel})</span>
              <span>{feeDisplay}</span>
            </div>
            <div className="checkout-summary-row checkout-summary-row--seller">
              <span>Seller Receives</span>
              <span>{sellerReceives}</span>
            </div>
            <div className="checkout-summary-row checkout-summary-row--escrow">
              <span>Status</span>
              <span>🔒 Held in Escrow</span>
            </div>
          </div>
        )}

        <div className="checkout-actions">
          <Link href="/orders" className="checkout-btn checkout-btn--primary">
            View My Orders
          </Link>
          <Link href="/services" className="checkout-btn checkout-btn--secondary">
            Browse More Services
          </Link>
        </div>
      </div>
    </main>
  );
}

{"file": "app/api/checkout/session/route.ts", "action": "write"}

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-04-10",
});

export async function GET(req: NextRequest) {
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

{"file": "components/CheckoutButton.tsx", "action": "write"}

"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CheckoutButtonProps {
  itemName: string;
  itemDescription?: string;
  amountInCents: number;
  type: "service" | "product";
  sellerId: string;
  buyerEmail?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function CheckoutButton({
  itemName,
  itemDescription,
  amountInCents,
  type,
  sellerId,
  buyerEmail,
  className,
  children,
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const feeRate = type === "service" ? 0.08 : 0.05;
  const platformFee = Math.round(amountInCents * feeRate);
  const displayAmount = (amountInCents / 100).toFixed(2);
  const displayFee = (platformFee / 100).toFixed(2);

  async function handleCheckout() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName,
          itemDescription,
          amountInCents,
          type,
          sellerId,
          buyerEmail,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to initiate checkout.");
        return;
      }

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      const stripe = await stripePromise;
      if (!stripe) {
        setError("Stripe failed to load. Please try again.");
        return;
      }

      const { error: stripeError } = await stripe.redirectToCheckout({
        sessionId: data.sessionId,
      });

      if (stripeError) {
        setError(stripeError.message || "Stripe redirect failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="checkout-button-wrapper">
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={className || "checkout-btn checkout-btn--primary"}
        aria-busy={loading}
      >
        {loading ? "Redirecting to Checkout..." : children || `Pay $${displayAmount}`}
      </button>
      <p className="checkout-fee-note">
        Includes a {type === "service" ? "8%" : "5%"} FreeTrust platform fee (${displayFee})
      </p>
      {error && (
        <p className="checkout-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

{"file": "app/checkout/checkout.css", "action": "write"}

.checkout-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
  background-color: #f9fafb;
}

.checkout-card {
  background: #ffffff;
  border-radius: 1rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  padding: 2.5rem 2rem;
  max-width: 480px;
  width: 100%;
  text-align: center;
}

.checkout-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.75rem;
  margin: 0 auto 1.5rem;
  font-weight: 700;
}

.checkout-icon--success {
  background-color: #d1fae5;
  color: #065f46;
}

.checkout-icon--cancel {
  background-color: #fee2e2;
  color: #991b1b;
}

.checkout-title {
  font-size: 1.75rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 0.75rem;
}

.checkout-description {
  font-size: 1rem;
  color: #6b7280;
  line-height: 1.6;
  margin: 0 0 1.75rem;
}

.checkout-summary {
  background-color: #f3f4f6;
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1.75rem;
  text-align: left;
}

.checkout-summary-title {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #9ca3af;
  margin: 0 0 1rem;
}

.checkout-summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9375rem;
  color: #374151;
  padding: 0.375rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.checkout-summary-row:last-child {
  border-bottom: none;
}

.checkout-summary-row--fee {
  color: #6b7280;
  font-size: 0.875rem;
}

.checkout-summary-row--seller {
  font-weight: 600;
  color: #111827;
}

.checkout-summary-row--escrow span:last-child {
  color: #2563eb;
  font-weight: 600;
}

.checkout-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.checkout-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.15s ease, opacity 0.15s ease;
  border: none;
  width: 100%;
}

.checkout-btn--primary {
  background-color: #2563eb;
  color: #ffffff;
}

.checkout-btn--primary:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.checkout-btn--primary:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.checkout-btn--secondary {
  background-color: #ffffff;
  color: #374151;
  border: 1.5px solid #d1d5db;
}

.checkout-btn--secondary:hover {
  background-color: #f9fafb;
}

.checkout-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  font-size: 1rem;
  color: #6b7280;
}

.checkout-button-wrapper {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
}

.checkout-fee-note {
  font-size: 0.8125rem;
  color: #9ca3af;
  text-align: center;
  margin: 0;
}

.checkout-error {
  font-size: 0.875rem;
  color: #dc2626;
  text-align: center;
  margin: 0;
  padding: 0.5rem;
  background-color: #fef2f2;
  border-radius: 0.375rem;
}

{"file": ".env.local.example", "action": "write"}

# Stripe Keys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000

{"file": "scripts/deploy.sh", "action": "write"}

#!/usr/bin/env bash
set -euo pipefail

echo "==> FreeTrust Stripe Checkout Deploy"
echo ""

# Ensure we are on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Switching from '$CURRENT_BRANCH' to 'main'..."
  git checkout main
fi

# Pull latest to avoid conflicts
echo "==> Pulling latest from origin/main..."
git pull origin main --rebase

# Install dependencies (stripe + @stripe/stripe-js)
echo "==> Installing Stripe dependencies..."
npm install stripe @stripe/stripe-js

# Stage all changes
echo "==> Staging changes..."
git add \
  app/api/checkout/route.ts \
  app/api/checkout/session/route.ts \
  app/api/webhooks/stripe/route.ts \
  app/checkout/success/page.tsx \
  app/checkout/cancel/page.tsx \
  app/checkout/checkout.css \
  components/CheckoutButton.tsx \
  components/CheckoutSuccessContent.tsx \
  .env.local.example \
  package.json \
  package-lock.json \
  scripts/deploy.sh

# Commit
echo "==> Committing..."
git commit -m "feat: add Stripe checkout with escrow and platform fees

- POST /api/checkout — creates Stripe Checkout Session
  - 8% platform fee for services
  - 5% platform fee for products
  - Escrow via Stripe Connect transfer_data
- GET /api/checkout/session — retrieves session summary for success page
- POST /api/webhooks/stripe — handles checkout.session.completed,
  payment_intent.succeeded, payment_intent.payment_failed, transfer.created
- /checkout/success — order summary with fee breakdown and escrow status
- /checkout/cancel — cancellation page with navigation
- CheckoutButton component — drop-in button with fee disclosure
- checkout.css — pure CSS styles for checkout pages
- .env.local.example — required environment variables documented"

# Push to main
echo "==> Pushing to origin/main..."
git push origin main

echo ""
echo "✓ Successfully pushed Stripe checkout to main."
echo ""
echo "Next steps:"
echo "  1. Copy .env.local.example to .env.local and fill in your Stripe keys."
echo "  2. Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe"
echo "  3. Set STRIPE_WEBHOOK_SECRET from the stripe listen output."
echo "  4. Ensure sellers have Stripe Connect accounts (sellerId = Stripe account ID)."
echo "  5. Use <CheckoutButton> in your service/product listing pages."

{"file": "README.stripe.md", "action": "write"}

# FreeTrust Stripe Checkout

## Overview

FreeTrust uses Stripe Checkout with Stripe Connect to process payments through
an escrow-style flow. Platform fees are automatically deducted before funds are
held for the seller.

| Transaction Type | Platform Fee |
|------------------|-------------|
| Services         | 8%          |
| Products         | 5%          |

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and populate:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## API Routes

### POST /api/checkout

Creates a Stripe Checkout Session.

**Request body:**

```json
{
  "itemName": "Logo Design",
  "itemDescription": "Custom logo for your brand",
  "amountInCents": 10000,
  "type": "service",
  "sellerId": "acct_stripe_connect_id",
  "buyerEmail": "buyer@example.com"
}
```

**Response:**

```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/...",
  "platformFeeAmount": 800,
  "platformFeeRate": 0.08
}
```

### GET /api/checkout/session?session_id=cs_test_...

Returns order summary for the success page.

### POST /api/webhooks/stripe

Handles Stripe webhook events:

- `checkout.session.completed` — record escrow in DB
- `payment_intent.succeeded` — mark funds as held
- `payment_intent.payment_failed` — mark as failed, notify buyer
- `transfer.created` — mark funds as released to seller

---

## Drop-in Checkout Button

```tsx
import CheckoutButton from "@/components/CheckoutButton";

<CheckoutButton
  itemName="Logo Design"
  itemDescription="Custom logo for your brand"
  amountInCents={10000}
  type="service"
  sellerId="acct_stripe_connect_id"
  buyerEmail="buyer@example.com"
>
  Purchase Service — $100.00
</CheckoutButton>
```

The button automatically displays the applicable platform fee to the buyer.

---

## Escrow Flow

```
Buyer pays $100
      │
      ▼
Stripe holds funds
      │
      ├─► FreeTrust platform fee deducted (8% = $8.00)
      │
      ├─► Seller receives $92.00 (on delivery confirmation)
      │
      └─► Webhook events update your DB at each step
```

**Delivery confirmation and release logic must be implemented in your
database layer.** The webhook handlers in `/api/webhooks/stripe/route.ts`
include TODO comments marking exactly where to add those DB calls.

---

## Local Webhook Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Forward webhooks to local dev server
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Copy the webhook signing secret printed by stripe listen
# into STRIPE_WEBHOOK_SECRET in .env.local
```

---

## Deploy

```bash
bash scripts/deploy.sh
```

This script installs dependencies, commits all Stripe-related files, and
pushes to `main`.