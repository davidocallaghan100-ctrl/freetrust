/**
 * Stripe €99 Early Investor Smoke Test
 *
 * Creates a real Stripe Checkout Session for the Seed Founder tier (€99)
 * using the live STRIPE_SECRET_KEY from .env.local.
 *
 * Run: cd /home/computer/freetrust && npx tsx scripts/stripe-smoke-test.ts
 *
 * What it checks:
 *   1. Session is created successfully (no Stripe API error)
 *   2. session.status === 'open'
 *   3. session.payment_status === 'unpaid'
 *   4. session.url is a valid Stripe checkout URL
 *   5. session.metadata matches expected Seed tier values
 *   6. session.amount_total === 9900 (€99.00 in cents)
 */

import * as fs from 'fs'
import * as path from 'path'

// ── Load .env.local ──────────────────────────────────────────────────────────
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.warn('[smoke-test] .env.local not found — relying on process.env')
    return
  }
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let value = trimmed.slice(eqIdx + 1).trim()
    // Strip surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    // Don't overwrite values already set in the environment
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
  console.log('[smoke-test] Loaded .env.local')
}

loadEnvLocal()

// ── Stripe setup ─────────────────────────────────────────────────────────────
import Stripe from 'stripe'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY
if (!STRIPE_SECRET_KEY) {
  console.error('❌ FATAL: STRIPE_SECRET_KEY is not set in .env.local or environment')
  process.exit(1)
}

const isLiveKey = STRIPE_SECRET_KEY.startsWith('sk_live_')
const isTestKey = STRIPE_SECRET_KEY.startsWith('sk_test_')

console.log(`\n[smoke-test] Stripe key type: ${isLiveKey ? '🔴 LIVE' : isTestKey ? '🟡 TEST' : '❓ UNKNOWN'}`)
if (isLiveKey) {
  console.warn('[smoke-test] ⚠️  Using LIVE key — this creates a REAL Stripe session (no charge until card is entered)')
}

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })

// ── Seed tier constants (from lib/founder/tiers.ts) ──────────────────────────
const SEED_TIER = {
  key: 'seed',
  displayName: 'Seed',
  priceEur: 99,
  priceCents: 9900,
  serviceFeeBps: 450,
  productFeeBps: 275,
  serviceFeePercent: 4.5,
  productFeePercent: 2.75,
  aiCreditsBonus: 150,
  trustBonus: 100,
  monthlyAiCreditRefill: 20,
}

const ORIGIN = 'https://freetrust.co'

// ── Run the smoke test ────────────────────────────────────────────────────────
async function runSmokeTest() {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  FreeTrust Stripe Smoke Test — €99 Early Investor (Seed)')
  console.log('═══════════════════════════════════════════════════════════\n')

  const checks: Array<{ name: string; passed: boolean; detail?: string }> = []

  let session: Stripe.Checkout.Session | null = null

  // ── CHECK 1: Session creation ─────────────────────────────────────────────
  console.log('📡 Creating Stripe Checkout Session...')
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            product_data: {
              name: `FreeTrust ${SEED_TIER.displayName} Founder`,
              description:
                `Lifetime ${SEED_TIER.serviceFeePercent}% / ${SEED_TIER.productFeePercent}% fees` +
                ` · +${SEED_TIER.aiCreditsBonus.toLocaleString()} AI Credits` +
                ` · +${SEED_TIER.trustBonus.toLocaleString()} TrustCoins` +
                ` · +${SEED_TIER.monthlyAiCreditRefill}/mo refill for life`,
            },
            unit_amount: SEED_TIER.priceCents,
          },
        },
      ],
      // Use a placeholder user ID for the smoke test
      client_reference_id: 'smoke-test-user-id',
      customer_email: 'david@freetrust.co',
      metadata: {
        type: 'founder_investment',
        user_id: 'smoke-test-user-id',
        tier_key: SEED_TIER.key,
        tier_display_name: SEED_TIER.displayName,
        investment_amount_eur: SEED_TIER.priceEur.toString(),
        service_fee_bps: SEED_TIER.serviceFeeBps.toString(),
        product_fee_bps: SEED_TIER.productFeeBps.toString(),
        ai_credits_bonus: SEED_TIER.aiCreditsBonus.toString(),
        trust_bonus: SEED_TIER.trustBonus.toString(),
        monthly_refill: SEED_TIER.monthlyAiCreditRefill.toString(),
      },
      success_url: `${ORIGIN}/invest/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/invest?canceled=1`,
    })

    checks.push({ name: 'Session created without error', passed: true, detail: `id: ${session.id}` })
    console.log(`✅ Session created: ${session.id}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    checks.push({ name: 'Session created without error', passed: false, detail: msg })
    console.error(`❌ Session creation FAILED: ${msg}`)
    printSummary(checks, null)
    process.exit(1)
  }

  if (!session) {
    console.error('❌ Session is null after creation — aborting')
    process.exit(1)
  }

  // ── CHECK 2: session.status === 'open' ─────────────────────────────────────
  const statusOk = session.status === 'open'
  checks.push({
    name: "session.status === 'open'",
    passed: statusOk,
    detail: `actual: ${session.status}`,
  })

  // ── CHECK 3: session.payment_status === 'unpaid' ──────────────────────────
  const paymentStatusOk = session.payment_status === 'unpaid'
  checks.push({
    name: "session.payment_status === 'unpaid'",
    passed: paymentStatusOk,
    detail: `actual: ${session.payment_status}`,
  })

  // ── CHECK 4: session.url is a valid Stripe checkout URL ───────────────────
  const urlOk = typeof session.url === 'string' && session.url.startsWith('https://checkout.stripe.com/')
  checks.push({
    name: 'session.url is valid Stripe checkout URL',
    passed: urlOk,
    detail: session.url ?? 'null',
  })

  // ── CHECK 5: Metadata matches Seed tier ───────────────────────────────────
  const meta = session.metadata ?? {}
  const metaChecks = [
    { key: 'type', expected: 'founder_investment' },
    { key: 'tier_key', expected: 'seed' },
    { key: 'tier_display_name', expected: 'Seed' },
    { key: 'investment_amount_eur', expected: '99' },
    { key: 'service_fee_bps', expected: '450' },
    { key: 'product_fee_bps', expected: '275' },
    { key: 'ai_credits_bonus', expected: '150' },
    { key: 'trust_bonus', expected: '100' },
    { key: 'monthly_refill', expected: '20' },
  ]
  let metaOk = true
  const metaDetails: string[] = []
  for (const { key, expected } of metaChecks) {
    const actual = meta[key]
    if (actual !== expected) {
      metaOk = false
      metaDetails.push(`${key}: expected "${expected}", got "${actual}"`)
    }
  }
  checks.push({
    name: 'Metadata matches Seed tier values',
    passed: metaOk,
    detail: metaOk ? 'All 9 metadata fields correct' : metaDetails.join('; '),
  })

  // ── CHECK 6: Amount total === 9900 (€99.00) ───────────────────────────────
  const amountOk = session.amount_total === 9900
  checks.push({
    name: 'amount_total === 9900 (€99.00)',
    passed: amountOk,
    detail: `actual: ${session.amount_total}`,
  })

  // ── CHECK 7: Currency is EUR ──────────────────────────────────────────────
  const currencyOk = session.currency === 'eur'
  checks.push({
    name: "currency === 'eur'",
    passed: currencyOk,
    detail: `actual: ${session.currency}`,
  })

  // ── CHECK 8: Success / cancel URLs ───────────────────────────────────────
  const successUrlOk =
    typeof session.success_url === 'string' &&
    session.success_url.includes('/invest/success')
  const cancelUrlOk =
    typeof session.cancel_url === 'string' &&
    session.cancel_url.includes('/invest?canceled=1')
  checks.push({
    name: 'success_url contains /invest/success',
    passed: successUrlOk,
    detail: session.success_url ?? 'null',
  })
  checks.push({
    name: 'cancel_url contains /invest?canceled=1',
    passed: cancelUrlOk,
    detail: session.cancel_url ?? 'null',
  })

  // ── Log full session object ───────────────────────────────────────────────
  console.log('\n─── Full Stripe Session Object ───────────────────────────')
  console.log(JSON.stringify({
    id: session.id,
    status: session.status,
    payment_status: session.payment_status,
    amount_total: session.amount_total,
    currency: session.currency,
    customer_email: session.customer_email,
    client_reference_id: session.client_reference_id,
    metadata: session.metadata,
    success_url: session.success_url,
    cancel_url: session.cancel_url,
    url: session.url,
    created: new Date((session.created ?? 0) * 1000).toISOString(),
    expires_at: new Date((session.expires_at ?? 0) * 1000).toISOString(),
  }, null, 2))

  printSummary(checks, session.url)
}

function printSummary(
  checks: Array<{ name: string; passed: boolean; detail?: string }>,
  checkoutUrl: string | null | undefined,
) {
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('  SMOKE TEST RESULTS')
  console.log('═══════════════════════════════════════════════════════════')

  let allPassed = true
  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌'
    console.log(`  ${icon}  ${check.name}`)
    if (check.detail) {
      console.log(`       ${check.detail}`)
    }
    if (!check.passed) allPassed = false
  }

  console.log('\n───────────────────────────────────────────────────────────')
  const total = checks.length
  const passed = checks.filter(c => c.passed).length
  const failed = total - passed

  if (allPassed) {
    console.log(`  ✅  ALL ${total}/${total} CHECKS PASSED — Stripe flow is healthy`)
  } else {
    console.log(`  ❌  ${passed}/${total} PASSED, ${failed}/${total} FAILED`)
  }

  if (checkoutUrl) {
    console.log('\n  Checkout URL (valid for 24 hours):')
    console.log(`  ${checkoutUrl}`)
    console.log('\n  ⚠️  This is a REAL Stripe session. Visiting the URL will')
    console.log('     show a real checkout form. Do NOT enter a real card.')
    console.log('     Use Stripe test card: 4242 4242 4242 4242 (test sessions only).')
  }

  console.log('═══════════════════════════════════════════════════════════\n')

  if (!allPassed) process.exit(1)
}

runSmokeTest().catch(err => {
  console.error('\n❌ SMOKE TEST CRASHED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
