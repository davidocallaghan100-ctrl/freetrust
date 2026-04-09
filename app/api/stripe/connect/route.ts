export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase/server'

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

// GET — return onboarding link for current user
export async function GET() {
  if (!stripe) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user already has a Stripe Connect account
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', user.id)
      .single()

    let accountId = profile?.stripe_account_id

    // Create a new Connect account if none exists
    if (!accountId) {
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

      await supabase
        .from('profiles')
        .update({ stripe_account_id: accountId })
        .eq('id', user.id)
    }

    // If already fully onboarded, return status
    if (profile?.stripe_onboarded) {
      const account = await stripe.accounts.retrieve(accountId)
      return NextResponse.json({
        onboarded: true,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        account_id: accountId,
      })
    }

    // Generate fresh onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${BASE_URL}/seller/connect/refresh`,
      return_url: `${BASE_URL}/seller/connect/complete`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url, account_id: accountId })
  } catch (err) {
    console.error('[GET /api/stripe/connect]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST — check or refresh Connect account status, or get dashboard link
export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Payments not configured' }, { status: 503 })

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { action } = await req.json()

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id, stripe_onboarded')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_account_id) {
      return NextResponse.json({ error: 'No Connect account found' }, { status: 404 })
    }

    const account = await stripe.accounts.retrieve(profile.stripe_account_id)

    // Mark as onboarded in DB when Stripe confirms fully enabled
    if (account.charges_enabled && account.payouts_enabled && !profile.stripe_onboarded) {
      await supabase
        .from('profiles')
        .update({ stripe_onboarded: true })
        .eq('id', user.id)
    }

    if (action === 'dashboard') {
      const loginLink = await stripe.accounts.createLoginLink(profile.stripe_account_id)
      return NextResponse.json({ url: loginLink.url })
    }

    return NextResponse.json({
      onboarded: account.charges_enabled && account.payouts_enabled,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      account_id: profile.stripe_account_id,
    })
  } catch (err) {
    console.error('[POST /api/stripe/connect]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
