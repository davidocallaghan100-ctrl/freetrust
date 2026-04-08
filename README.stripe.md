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