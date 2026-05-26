// ────────────────────────────────────────────────────────────────────────────
// Stripe Identity verification endpoint
// ────────────────────────────────────────────────────────────────────────────
//
// POST /api/profile/identity-verification
//   Creates a Stripe Identity VerificationSession for the calling user.
//   If a 'pending' or 'verified' row already exists, returns the existing
//   session's client_secret rather than creating a new one — idempotent
//   from the client's perspective. Sets metadata.user_id on the session
//   so the webhook can identify the user when events arrive.
//
// GET /api/profile/identity-verification
//   Returns the calling user's verification row:
//     { status, verified_at, bonus_granted_at, last_attempt_at }
//
// All writes happen via the admin client because profile_verifications
// is service_role-only (RLS blocks authenticated INSERT/UPDATE/DELETE).

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: 'Identity verification not configured' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const admin = createAdminClient()

  // Reuse an in-flight session if one already exists for this user.
  // The webhook may have lost the client_secret before the user got
  // back to the page, so we retrieve from Stripe to repopulate it.
  const { data: existing } = await admin
    .from('profile_verifications')
    .select('status, stripe_verification_session_id, verified_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.status === 'verified') {
    return NextResponse.json({
      status: 'verified',
      verified_at: existing.verified_at,
      message: 'Already verified',
    })
  }

  if (existing?.status === 'pending' && existing.stripe_verification_session_id) {
    try {
      const session = await stripe.identity.verificationSessions.retrieve(
        existing.stripe_verification_session_id,
      )
      // If Stripe still considers the session usable, return its
      // client_secret rather than creating a new one.
      if (session.status === 'requires_input' || session.status === 'processing') {
        return NextResponse.json({
          status: 'pending',
          session_id: session.id,
          client_secret: session.client_secret,
        })
      }
    } catch (err) {
      // Fall through to creating a fresh session — old session is gone.
      console.warn('[identity-verification] could not retrieve existing session, creating new', err instanceof Error ? err.message : err)
    }
  }

  // Create a new VerificationSession. metadata.user_id is the link the
  // webhook uses to identify the user — without this the webhook has
  // no way to attribute the verification event.
  let session: Stripe.Identity.VerificationSession
  try {
    session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: { user_id: user.id },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[identity-verification] failed to create session:', message)
    return NextResponse.json({ error: `Failed to create verification session: ${message}` }, { status: 500 })
  }

  // Upsert the local row to pending. The webhook will also handle this
  // on identity.verification_session.created, but the request-response
  // round trip wants the row to exist immediately so the UI can flip
  // to "pending" without waiting on the webhook.
  if (existing) {
    await admin
      .from('profile_verifications')
      .update({
        stripe_verification_session_id: session.id,
        status: 'pending',
        last_attempt_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
  } else {
    await admin
      .from('profile_verifications')
      .insert({
        user_id: user.id,
        stripe_verification_session_id: session.id,
        status: 'pending',
        last_attempt_at: new Date().toISOString(),
        attempt_count: 1,
      })
  }

  return NextResponse.json({
    status: 'pending',
    session_id: session.id,
    client_secret: session.client_secret,
  })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Read via the user-session client so RLS gates the read (defence in
  // depth — the policy on profile_verifications already restricts to
  // auth.uid() = user_id).
  const { data, error } = await supabase
    .from('profile_verifications')
    .select('status, verified_at, bonus_granted_at, last_attempt_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[identity-verification] GET failed:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    status: data?.status ?? 'unverified',
    verified_at: data?.verified_at ?? null,
    bonus_granted_at: data?.bonus_granted_at ?? null,
    last_attempt_at: data?.last_attempt_at ?? null,
  })
}
