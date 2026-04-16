import { createAdminClient } from '@/lib/supabase/admin'

// Canonical Stripe Connect onboarding gate for paid-listing flows.
//
// Rules:
//   * Free listings (price === 0 or null/undefined) — skip the gate
//     entirely. Returns { ok: true, isConnected: boolean }.
//   * Paid listings — require stripe_onboarded === true OR
//     stripe_onboarding_complete === true. Either column is a valid
//     signal (they're kept in sync by a trigger from
//     20260416000003_escrow_columns.sql, but older projects may only
//     have one).
//
// Returns a discriminated union so callers can short-circuit with
// NextResponse.json(res.blockedResponse, { status: 412 }) without
// re-deriving the message.

export interface ConnectGateOk {
  ok:          true
  isConnected: boolean
}

export interface ConnectGateBlocked {
  ok:          false
  blockedResponse: {
    error:              'stripe_not_connected'
    message:            string
    onboarding_url:     string
  }
}

export type ConnectGateResult = ConnectGateOk | ConnectGateBlocked

export async function assertStripeConnectedForPaidListing(
  userId: string,
  price: number | null | undefined,
): Promise<ConnectGateResult> {
  // Free listings bypass the gate — users can always publish at ₮0.
  if (price === null || price === undefined || Number(price) === 0) {
    return { ok: true, isConnected: false }
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded, stripe_onboarding_complete')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // Old schemas may not have stripe_onboarding_complete yet.
      // Retry without it — stripe_onboarded alone is still a valid
      // signal on pre-20260416 projects.
      const legacy = await admin
        .from('profiles')
        .select('stripe_account_id, stripe_onboarded')
        .eq('id', userId)
        .maybeSingle()
      if (legacy.error) {
        console.error('[connect-gate] profile lookup failed:', legacy.error)
        return blocked()
      }
      const onboarded = Boolean(legacy.data?.stripe_onboarded)
      return onboarded ? { ok: true, isConnected: true } : blocked()
    }

    const onboarded = Boolean(
      data?.stripe_onboarded === true ||
      (data as Record<string, unknown> | null)?.['stripe_onboarding_complete'] === true,
    )
    return onboarded ? { ok: true, isConnected: true } : blocked()
  } catch (err) {
    console.error('[connect-gate] unexpected:', err)
    return blocked()
  }
}

function blocked(): ConnectGateBlocked {
  return {
    ok: false,
    blockedResponse: {
      error:          'stripe_not_connected',
      message:        'Connect your Stripe account before publishing a paid listing. It takes ~2 minutes and unlocks payouts to your bank.',
      onboarding_url: '/wallet?connect=true',
    },
  }
}
