export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch current profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, bio, avatar_url, cover_url, location, website, username, trust_balance, profile_bonus_claimed')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Already claimed?
    if (profile.profile_bonus_claimed) {
      return NextResponse.json({ alreadyClaimed: true, bonus: 0 })
    }

    // Check completeness — 7 fields
    const fields = [
      profile.full_name,
      profile.bio,
      profile.avatar_url,
      profile.cover_url,
      profile.location,
      profile.website,
      profile.username,
    ]
    const filledCount = fields.filter(Boolean).length
    const isComplete = filledCount >= 7

    if (!isComplete) {
      return NextResponse.json({ alreadyClaimed: false, bonus: 0, filledCount, message: 'Profile not yet 100% complete' })
    }

    // Award ₮10
    const newBalance = (profile.trust_balance ?? 0) + 10
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ trust_balance: newBalance, profile_bonus_claimed: true })
      .eq('id', user.id)

    if (updateError) {
      console.error('[complete-bonus] update error:', updateError)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    // Log to trust_ledger
    await supabase.from('trust_ledger').insert({
      user_id: user.id,
      amount: 10,
      type: 'profile_complete',
      description: 'Profile 100% complete bonus',
    })

    return NextResponse.json({ bonus: 10, newBalance, claimed: true })
  } catch (err) {
    console.error('[complete-bonus] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
