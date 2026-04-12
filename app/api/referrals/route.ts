export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/referrals
// Returns the current user's referral code, list of referrals (with referred
// user profile), and aggregate stats for the dashboard.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Get the user's referral code (guarantee one exists — backfill if the
    // trigger hasn't fired for this row yet)
    let { data: profile } = await admin
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile?.referral_code) {
      // Generate one inline
      const code = generateCode()
      const { data: updated } = await admin
        .from('profiles')
        .update({ referral_code: code })
        .eq('id', user.id)
        .select('referral_code')
        .maybeSingle()
      profile = updated
    }

    // Fetch referrals made BY this user, newest first
    const { data: referrals, error: refErr } = await admin
      .from('referrals')
      .select('id, referred_id, status, reward_credited, reward_amount, completed_at, created_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })

    if (refErr) {
      console.error('[GET /api/referrals] fetch error:', refErr)
      return NextResponse.json({ error: refErr.message }, { status: 500 })
    }

    // Enrich with referred-user profiles
    const referredIds = (referrals ?? []).map(r => r.referred_id)
    let profileMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
    if (referredIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', referredIds)
      profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
    }

    const enriched = (referrals ?? []).map(r => ({
      id: r.id,
      referred_id: r.referred_id,
      referred_name: profileMap[r.referred_id]?.full_name ?? 'New member',
      referred_avatar: profileMap[r.referred_id]?.avatar_url ?? null,
      status: r.status as 'pending' | 'completed',
      reward_credited: r.reward_credited,
      reward_amount: r.reward_amount,
      completed_at: r.completed_at,
      created_at: r.created_at,
    }))

    // Aggregate stats
    const total = enriched.length
    const pending = enriched.filter(r => r.status === 'pending').length
    const completed = enriched.filter(r => r.status === 'completed').length
    const tokensEarned = enriched
      .filter(r => r.reward_credited)
      .reduce((s, r) => s + r.reward_amount, 0)

    return NextResponse.json({
      referral_code: profile?.referral_code ?? null,
      stats: { total, pending, completed, tokens_earned: tokensEarned },
      referrals: enriched,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[GET /api/referrals] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Match the SQL generate_referral_code() behaviour
function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 7; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
