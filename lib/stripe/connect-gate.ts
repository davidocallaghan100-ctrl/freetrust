import { createAdminClient } from '@/lib/supabase/admin'

// Canonical Stripe Connect status checker for paid-listing flows.
//
// POLICY (Apr 2026): Stripe Connect is OPTIONAL at publish time.
// Sellers can publish any listing — paid or free — without connecting
// Stripe. The gate will never block. Instead it reports isConnected so
// callers can surface a soft nudge ("connect Stripe before your first
// sale") in the response body without blocking the publish.
//
// Stripe Connect is only required at the point a buyer actually attempts
// to pay — the checkout route enforces that separately.

export interface ConnectGateOk {
  ok:          true
  isConnected: boolean
}

// Keep the blocked type for backwards-compat with existing callers even
// though it is never returned by this function anymore.
export interface ConnectGateBlocked {
  ok:          false
  blockedResponse: {
    error:              'stripe_not_connected'
    message:            string
    onboarding_url:     string
  }
}

// NOTE: The function always returns ConnectGateOk now (never blocks).
// ConnectGateBlocked is kept for backwards-compat only.
export type ConnectGateResult = ConnectGateOk

export async function assertStripeConnectedForPaidListing(
  userId: string,
  price: number | null | undefined,
): Promise<ConnectGateResult> {
  // Free listings — skip the DB lookup entirely.
  if (price === null || price === undefined || Number(price) === 0) {
    return { ok: true, isConnected: false }
  }

  // For paid listings: check Stripe status but NEVER block publish.
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded, stripe_onboarding_complete')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // Old schemas may not have stripe_onboarding_complete yet.
      const legacy = await admin
        .from('profiles')
        .select('stripe_account_id, stripe_onboarded')
        .eq('id', userId)
        .maybeSingle()
      if (legacy.error) {
        console.error('[connect-gate] profile lookup failed:', legacy.error)
        // Fail open — don't block the seller.
        return { ok: true, isConnected: false }
      }
      return { ok: true, isConnected: Boolean(legacy.data?.stripe_onboarded) }
    }

    const onboarded = Boolean(
      data?.stripe_onboarded === true ||
      (data as Record<string, unknown> | null)?.['stripe_onboarding_complete'] === true,
    )
    return { ok: true, isConnected: onboarded }
  } catch (err) {
    console.error('[connect-gate] unexpected:', err)
    // Fail open — don't block the seller.
    return { ok: true, isConnected: false }
  }
}
