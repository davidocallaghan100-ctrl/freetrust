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

