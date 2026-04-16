export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

// Detect and surface the "Connect not enabled on this Stripe account" error
// clearly. This is a COMMON setup gotcha: your STRIPE_SECRET_KEY is valid,
// but the Stripe account that owns it hasn't enabled Connect in the
// dashboard yet, so stripe.accounts.create() rejects with a message like:
//
//   "You can only create new accounts if you've signed up for Connect,
//    which you can do on the dashboard at
//    https://dashboard.stripe.com/account/applications/settings."
//
// If we get that error we return an actionable 503 so the frontend can
// show the user a clear "payments are still being set up" toast and so
// the server log prints the exact steps the operator needs to take.
//
// Operator kill-switch:
//   If STRIPE_CONNECT_FORCE_ENABLED is set to 'true', the matcher always
//   returns false. This is the escape hatch for the case where Connect
//   IS properly configured but the matcher is false-positiving (e.g.
//   because Stripe's error message text changes in a future API version
//   and no longer matches our substrings). Setting this env var lets
//   the raw Stripe error propagate to the caller instead of being
//   masked as "still being set up", so the operator can see and act
//   on the real failure mode — no code redeploy required.
function isConnectNotEnabledError(err: unknown): boolean {
  // Kill switch — the operator has declared Connect IS enabled, so
  // any Stripe error that reaches this matcher is by definition NOT
  // a "Connect not enabled" error.
  if (process.env.STRIPE_CONNECT_FORCE_ENABLED === 'true') return false

  const msg = err instanceof Error ? err.message : String(err)
  // Only match on the specific error sentence patterns Stripe uses,
  // not on the dashboard URL — the URL fragment appears in other
  // unrelated Stripe error messages (e.g. permissions hints pointing
  // at the overview page) and used to false-positive here.
  return (
    msg.includes("signed up for Connect")  ||
    msg.includes('sign up for Connect')    ||
    msg.includes('Connect is not enabled') ||
    msg.includes("haven't signed up for Connect")
  )
}

// Extract the Stripe-specific error fields (type, code, raw message,
// status) for both logging and the client response. Stripe errors have
// these fields attached — we want them visible to operators so a future
// diagnosis doesn't need Vercel logs.
function stripeErrorDetail(err: unknown): {
  message: string
  type:    string | null
  code:    string | null
  status:  number | null
} {
  const e = err as { message?: string; type?: string; code?: string; statusCode?: number } | null | undefined
  return {
    message: typeof e?.message === 'string' ? e.message : String(err),
    type:    typeof e?.type    === 'string' ? e.type    : null,
    code:    typeof e?.code    === 'string' ? e.code    : null,
    status:  typeof e?.statusCode === 'number' ? e.statusCode : null,
  }
}

const CONNECT_SETUP_STEPS =
  'Stripe Connect is not enabled on this Stripe account yet. ' +
  'Operator: open https://dashboard.stripe.com/test/connect/accounts/overview ' +
  '(or /connect/accounts/overview in live mode), click "Get started", ' +
  'choose the Express platform type, and complete the Connect platform ' +
  'application form. Once Connect is approved the Withdraw Earnings ' +
  'button will work immediately — no code redeploy needed. ' +
  'If Connect IS enabled and this message is still showing, set the ' +
  'env var STRIPE_CONNECT_FORCE_ENABLED=true in Vercel to bypass the ' +
  'matcher and see the raw Stripe error.'

// Build a uniform 503 response for every callsite that catches a
// Connect-not-enabled error. Includes the raw Stripe error details
// (type, code, message, status) in the JSON body so an operator
// inspecting the browser Network tab can immediately confirm whether
// it's a genuine Connect-not-enabled error or a false-positive.
function connectNotEnabledResponse(
  err: unknown,
  site: string,
): NextResponse {
  const detail = stripeErrorDetail(err)
  console.error(
    `[stripe/connect:${site}] Connect-not-enabled matcher fired. ` +
    CONNECT_SETUP_STEPS,
    detail,
  )
  return NextResponse.json(
    {
      error:
        'Withdrawals are not available yet — Stripe Connect ' +
        'is still being set up for this platform. Please try ' +
        'again soon or contact support.',
      code:               'connect_not_enabled',
      setup_instructions: CONNECT_SETUP_STEPS,
      // Raw Stripe error — ONLY safe to expose because a real Connect-
      // not-enabled error contains no user data, just the operator-
      // facing setup prompt. Any other Stripe error will have gone
      // through isConnectNotEnabledError() which would have returned
      // false and we'd have hit the generic 502 path instead.
      stripe_error:       detail,
    },
    { status: 503 },
  )
}

// Warn loudly if the key environment is obviously wrong, e.g. a live key
// is being used in a preview deploy. We don't block — we just log — because
// a legitimate production deploy will also use a live key.
function keyEnvironmentDescription(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? ''
  if (key.startsWith('sk_live_')) return 'live'
  if (key.startsWith('sk_test_')) return 'test'
  if (key.startsWith('sk_')) return 'unknown-sk'
  return 'unknown'
}

// Fetch the Stripe-related profile fields, tolerating the case where the
// stripe_onboarded migration hasn't been applied yet. If the combined query
// fails (most likely because stripe_onboarded column is missing in the DB),
// retry with just stripe_account_id so the withdraw flow still works and
// we get a meaningful error in the logs.
async function fetchProfileStripeFields(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{
  stripe_account_id: string | null
  stripe_onboarded: boolean
  onboarded_col_missing: boolean
  error: string | null
}> {
  const full = await supabase
    .from('profiles')
    .select('stripe_account_id, stripe_onboarded')
    .eq('id', userId)
    .maybeSingle()

  if (!full.error) {
    return {
      stripe_account_id: (full.data?.stripe_account_id as string | null) ?? null,
      stripe_onboarded: Boolean(full.data?.stripe_onboarded),
      onboarded_col_missing: false,
      error: null,
    }
  }

  console.warn(
    '[stripe/connect] profile full select failed, falling back to stripe_account_id only:',
    full.error.message
  )

  // Fall back to querying only stripe_account_id — this still works if the
  // stripe_onboarded column is missing from the DB.
  const partial = await supabase
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', userId)
    .maybeSingle()

  if (partial.error) {
    return {
      stripe_account_id: null,
      stripe_onboarded: false,
      onboarded_col_missing: true,
      error: partial.error.message,
    }
  }

  return {
    stripe_account_id: (partial.data?.stripe_account_id as string | null) ?? null,
    stripe_onboarded: false, // unknown — treat as not onboarded; Stripe call below is source of truth
    onboarded_col_missing: true,
    error: null,
  }
}

// GET — return onboarding link for current user, OR { onboarded: true } if
// Stripe confirms the account has charges + payouts enabled (regardless of
// whether the stripe_onboarded DB column is in sync).
export async function GET() {
  console.log('[GET /api/stripe/connect] start')

  if (!stripe) {
    console.error('[GET /api/stripe/connect] STRIPE_SECRET_KEY not set')
    return NextResponse.json(
      { error: 'Payments not configured. Please contact support.' },
      { status: 503 }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('[GET /api/stripe/connect] unauthorized', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await fetchProfileStripeFields(supabase, user.id)
    if (profile.error) {
      console.error('[GET /api/stripe/connect] profile query failed:', profile.error)
      return NextResponse.json(
        { error: 'Could not load your account. Please try again.' },
        { status: 500 }
      )
    }

    let accountId = profile.stripe_account_id

    // Create a new Connect account if none exists
    if (!accountId) {
      console.log(`[GET /api/stripe/connect] creating new Connect account for user=${user.id}`)
      try {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'IE',
          email: user.email!,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_profile: {
            mcc: '7372',
            url: BASE_URL,
          },
        })
        accountId = account.id
        console.log(`[GET /api/stripe/connect] created stripe_account_id=${accountId}`)

        const { error: updateErr } = await supabase
          .from('profiles')
          .update({ stripe_account_id: accountId })
          .eq('id', user.id)
        if (updateErr) {
          console.error('[GET /api/stripe/connect] failed to save stripe_account_id:', updateErr.message)
          // Continue — we still return the onboarding URL. The next GET
          // will see a missing account_id and create another one, but the
          // user can still complete withdrawal now.
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(
          `[GET /api/stripe/connect] stripe.accounts.create failed ` +
          `(key_env=${keyEnvironmentDescription()}):`,
          msg
        )
        if (isConnectNotEnabledError(err)) {
          return connectNotEnabledResponse(err, 'GET:accounts.create')
        }
        return NextResponse.json(
          { error: `Stripe account creation failed: ${msg}` },
          { status: 502 }
        )
      }
    }

    // Always ask Stripe directly whether the account is fully enabled, so
    // we don't depend on a possibly-stale `stripe_onboarded` DB column.
    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve(accountId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[GET /api/stripe/connect] stripe.accounts.retrieve(${accountId}) failed:`, msg)
      if (isConnectNotEnabledError(err)) {
        return connectNotEnabledResponse(err, 'GET:accounts.retrieve')
      }
      return NextResponse.json(
        { error: `Could not verify Stripe account: ${msg}` },
        { status: 502 }
      )
    }

    const fullyOnboarded = Boolean(account.charges_enabled && account.payouts_enabled)
    console.log(
      `[GET /api/stripe/connect] user=${user.id} account=${accountId} ` +
      `charges=${account.charges_enabled} payouts=${account.payouts_enabled} ` +
      `details_submitted=${account.details_submitted} db_onboarded=${profile.stripe_onboarded}`
    )

    // Sync DB if Stripe says onboarded but DB flag is stale. Ignore the
    // update error if the column is missing — the Stripe check is the
    // source of truth and we don't want to block the user.
    if (fullyOnboarded && !profile.stripe_onboarded && !profile.onboarded_col_missing) {
      const { error: syncErr } = await supabase
        .from('profiles')
        .update({ stripe_onboarded: true })
        .eq('id', user.id)
      if (syncErr) {
        console.warn('[GET /api/stripe/connect] onboarded sync failed:', syncErr.message)
      }
    }

    if (fullyOnboarded) {
      // Client will issue a POST { action: 'dashboard' } to get the Express
      // dashboard login link (see below).
      return NextResponse.json({
        onboarded: true,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        account_id: accountId,
      })
    }

    // Not yet fully onboarded — generate fresh onboarding link
    let onboardingUrl: string
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${BASE_URL}/seller/connect/refresh`,
        return_url: `${BASE_URL}/seller/connect/complete`,
        type: 'account_onboarding',
      })
      onboardingUrl = accountLink.url
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/stripe/connect] stripe.accountLinks.create failed:', msg)
      if (isConnectNotEnabledError(err)) {
        return connectNotEnabledResponse(err, 'GET:accountLinks.create')
      }
      return NextResponse.json(
        { error: `Could not start Stripe onboarding: ${msg}` },
        { status: 502 }
      )
    }

    console.log(`[GET /api/stripe/connect] returning onboarding url for account=${accountId}`)
    return NextResponse.json({ url: onboardingUrl, account_id: accountId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/stripe/connect] unhandled:', msg, err)
    return NextResponse.json(
      { error: `Withdraw flow failed: ${msg}` },
      { status: 500 }
    )
  }
}

// POST — check Connect account status, or get the Stripe Express dashboard
// login link for an already-onboarded account.
export async function POST(req: NextRequest) {
  console.log('[POST /api/stripe/connect] start')

  if (!stripe) {
    console.error('[POST /api/stripe/connect] STRIPE_SECRET_KEY not set')
    return NextResponse.json(
      { error: 'Payments not configured. Please contact support.' },
      { status: 503 }
    )
  }

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.warn('[POST /api/stripe/connect] unauthorized', authError?.message)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let action: string | undefined
    try {
      const body = await req.json()
      action = body?.action
    } catch {
      action = undefined
    }
    console.log(`[POST /api/stripe/connect] user=${user.id} action=${action ?? '(none)'}`)

    const profile = await fetchProfileStripeFields(supabase, user.id)
    if (profile.error) {
      console.error('[POST /api/stripe/connect] profile query failed:', profile.error)
      return NextResponse.json(
        { error: 'Could not load your account. Please try again.' },
        { status: 500 }
      )
    }

    if (!profile.stripe_account_id) {
      return NextResponse.json(
        { error: 'No Stripe Connect account yet — start onboarding first' },
        { status: 404 }
      )
    }

    let account: Stripe.Account
    try {
      account = await stripe.accounts.retrieve(profile.stripe_account_id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[POST /api/stripe/connect] stripe.accounts.retrieve(${profile.stripe_account_id}) failed:`,
        msg
      )
      if (isConnectNotEnabledError(err)) {
        return connectNotEnabledResponse(err, 'POST:accounts.retrieve')
      }
      return NextResponse.json(
        { error: `Could not verify Stripe account: ${msg}` },
        { status: 502 }
      )
    }

    const fullyOnboarded = Boolean(account.charges_enabled && account.payouts_enabled)

    // Keep the DB flag in sync when possible
    if (fullyOnboarded && !profile.stripe_onboarded && !profile.onboarded_col_missing) {
      const { error: syncErr } = await supabase
        .from('profiles')
        .update({ stripe_onboarded: true })
        .eq('id', user.id)
      if (syncErr) {
        console.warn('[POST /api/stripe/connect] onboarded sync failed:', syncErr.message)
      }
    }

    if (action === 'dashboard') {
      if (!fullyOnboarded) {
        return NextResponse.json(
          { error: 'Finish Stripe onboarding before opening the dashboard' },
          { status: 409 }
        )
      }
      try {
        const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id)
        console.log(`[POST /api/stripe/connect] returning dashboard url for account=${profile.stripe_account_id}`)
        return NextResponse.json({ url: loginLink.url })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[POST /api/stripe/connect] stripe.accounts.createLoginLink failed:', msg)
        if (isConnectNotEnabledError(err)) {
          return connectNotEnabledResponse(err, 'POST:accounts.createLoginLink')
        }
        return NextResponse.json(
          { error: `Could not open Stripe dashboard: ${msg}` },
          { status: 502 }
        )
      }
    }

    return NextResponse.json({
      onboarded: fullyOnboarded,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      account_id: profile.stripe_account_id,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/stripe/connect] unhandled:', msg, err)
    return NextResponse.json(
      { error: `Withdraw flow failed: ${msg}` },
      { status: 500 }
    )
  }
}
