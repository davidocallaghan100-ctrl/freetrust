export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/onboarding — save onboarding profile data
// NOTE: ₮25 trust is awarded exclusively in /auth/callback on signup.
//       Do NOT award trust here — it would double-count for email signups.
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

    // Read trust balance to confirm ₮25 was already issued at signup
    const { data: tb } = await supabase
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const trustBalance = tb?.balance ?? 0

    return NextResponse.json({ ok: true, trust_awarded: trustBalance })
  } catch (err) {
    console.error('[POST /api/onboarding]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
