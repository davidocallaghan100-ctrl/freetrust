export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/referrals/link { code }
// Links the current (newly signed-up) user to the referrer identified by `code`.
// Called from the auth callback or client-side after signup. Idempotent —
// re-calling with the same or a different code is a no-op once a referral exists.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { code?: string }
    const code = (body.code ?? '').toUpperCase().trim()
    if (!code) {
      return NextResponse.json({ error: 'Referral code required' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check if this user is already referred
    const { data: existing } = await admin
      .from('referrals')
      .select('id')
      .eq('referred_id', user.id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ linked: false, reason: 'already_referred' })
    }

    // Look up referrer by code
    const { data: referrer } = await admin
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle()

    if (!referrer) {
      return NextResponse.json({ linked: false, reason: 'invalid_code' }, { status: 404 })
    }

    if (referrer.id === user.id) {
      return NextResponse.json({ linked: false, reason: 'self_referral' }, { status: 400 })
    }

    // Create the referral row (status: pending) and stamp profiles.referred_by
    const { error: insertErr } = await admin
      .from('referrals')
      .insert({
        referrer_id: referrer.id,
        referred_id: user.id,
        status: 'pending',
        reward_credited: false,
        reward_amount: 50,
      })

    if (insertErr) {
      console.error('[POST /api/referrals/link] insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    await admin
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', user.id)

    // Notify the referrer
    await admin.from('notifications').insert({
      user_id: referrer.id,
      type: 'referral',
      title: '🎉 New referral!',
      body: 'Someone joined FreeTrust using your referral link. Once they complete their first transaction, you\'ll earn ₮50 trust.',
      link: '/settings?tab=referral',
    })

    return NextResponse.json({ linked: true })
  } catch (err) {
    console.error('[POST /api/referrals/link] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
