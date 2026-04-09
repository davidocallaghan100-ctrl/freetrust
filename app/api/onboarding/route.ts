import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/resend'

// POST /api/onboarding — complete onboarding, award ₮25 welcome trust
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      account_type, full_name, bio, location,
      skills, interests, purpose,
      avatar_url,
    } = body

    // Check if already completed
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_complete, full_name')
      .eq('id', user.id)
      .single()

    const alreadyDone = profile?.onboarding_complete

    // Update profile
    await supabase.from('profiles').upsert({
      id: user.id,
      account_type: account_type ?? 'individual',
      full_name: full_name ?? profile?.full_name,
      bio: bio ?? null,
      location: location ?? null,
      skills: skills ?? [],
      interests: interests ?? [],
      purpose: purpose ?? [],
      avatar_url: avatar_url ?? null,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })

    // Award ₮25 welcome trust — only once
    if (!alreadyDone) {
      await supabase.from('trust_ledger').insert({
        user_id: user.id,
        amount: 25,
        type: 'welcome_bonus',
        description: 'Welcome to FreeTrust! Founding member bonus.',
      })
      // Upsert trust_balances
      const { data: tb } = await supabase
        .from('trust_balances')
        .select('balance, lifetime')
        .eq('user_id', user.id)
        .single()

      if (tb) {
        await supabase.from('trust_balances').update({
          balance: (tb.balance ?? 0) + 25,
          lifetime: (tb.lifetime ?? 0) + 25,
        }).eq('user_id', user.id)
      } else {
        await supabase.from('trust_balances').insert({
          user_id: user.id,
          balance: 25,
          lifetime: 25,
        })
      }

      // Send welcome email
      try {
        await sendWelcomeEmail(user.email!, full_name ?? 'there')
      } catch { /* non-fatal */ }
    }

    return NextResponse.json({ ok: true, trust_awarded: !alreadyDone ? 25 : 0 })
  } catch (err) {
    console.error('[POST /api/onboarding]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
