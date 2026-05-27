export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed'

type VerificationRow = {
  status: VerificationStatus
  verified_at: string | null
  last_attempt_at: string | null
  attempt_count: number | null
  bonus_granted_at: string | null
}

function setupMissingResponse(message?: string) {
  return NextResponse.json({
    status: 'unconfigured' as const,
    error: message ?? 'Identity verification is not configured yet.',
  }, { status: 503 })
}

function isMissingVerificationSchema(err: unknown) {
  const message = err && typeof err === 'object' && 'message' in err
    ? String((err as { message?: unknown }).message ?? '')
    : String(err ?? '')
  return message.includes('profile_verifications') || message.includes('profile_verification')
}

async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, error: error?.message ?? 'Unauthorized' }
  return { user, error: null }
}

export async function GET() {
  const { user, error: authError } = await getAuthedUser()
  if (!user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profile_verifications')
      .select('status, verified_at, last_attempt_at, attempt_count, bonus_granted_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      if (isMissingVerificationSchema(error)) return setupMissingResponse(error.message)
      console.error('[identity-verification GET]', error.message)
      return NextResponse.json({ error: 'Could not load verification status.' }, { status: 500 })
    }

    const row = data as VerificationRow | null
    return NextResponse.json({
      status: row?.status ?? 'unverified',
      verified_at: row?.verified_at ?? null,
      last_attempt_at: row?.last_attempt_at ?? null,
      attempt_count: row?.attempt_count ?? 0,
      bonus_granted_at: row?.bonus_granted_at ?? null,
    })
  } catch (err) {
    if (isMissingVerificationSchema(err)) return setupMissingResponse()
    const message = err instanceof Error ? err.message : String(err)
    console.error('[identity-verification GET] unexpected:', message)
    return NextResponse.json({ error: 'Could not load verification status.' }, { status: 500 })
  }
}

export async function POST() {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe Identity is not configured yet.' }, { status: 503 })
  }

  const { user, error: authError } = await getAuthedUser()
  if (!user) return NextResponse.json({ error: authError ?? 'Unauthorized' }, { status: 401 })

  try {
    const supabase = createAdminClient()
    const { data: existing, error: existingError } = await supabase
      .from('profile_verifications')
      .select('status, attempt_count')
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingError) {
      if (isMissingVerificationSchema(existingError)) return setupMissingResponse(existingError.message)
      console.error('[identity-verification POST] existing query failed:', existingError.message)
      return NextResponse.json({ error: 'Could not start verification.' }, { status: 500 })
    }

    if ((existing as { status?: string } | null)?.status === 'verified') {
      return NextResponse.json({ error: 'Your profile is already verified.' }, { status: 409 })
    }

    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: user.id,
        source: 'freetrust_profile_settings',
      },
      provided_details: user.email ? { email: user.email } : undefined,
      return_url: `${BASE_URL}/settings?tab=security&identity=returned`,
    })

    if (!session.client_secret) {
      console.error('[identity-verification POST] Stripe returned no client_secret', session.id)
      return NextResponse.json({ error: 'Stripe did not return a verification client secret.' }, { status: 502 })
    }

    const now = new Date().toISOString()
    const nextAttemptCount = Number((existing as { attempt_count?: number | null } | null)?.attempt_count ?? 0) + 1
    const { error: upsertError } = await supabase
      .from('profile_verifications')
      .upsert({
        user_id: user.id,
        stripe_verification_session_id: session.id,
        status: 'pending',
        last_attempt_at: now,
        attempt_count: nextAttemptCount,
      }, { onConflict: 'user_id' })

    if (upsertError) {
      console.error('[identity-verification POST] upsert failed:', upsertError.message)
      return NextResponse.json({ error: 'Could not save verification session.' }, { status: 500 })
    }

    return NextResponse.json({
      client_secret: session.client_secret,
      session_id: session.id,
      status: 'pending',
    })
  } catch (err) {
    if (isMissingVerificationSchema(err)) return setupMissingResponse()
    const message = err instanceof Error ? err.message : String(err)
    console.error('[identity-verification POST] unexpected:', message)
    return NextResponse.json({ error: `Could not start verification: ${message}` }, { status: 500 })
  }
}
