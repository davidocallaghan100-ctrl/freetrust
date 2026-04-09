export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Top donors by total trust donated to impact
    const { data: donations } = await supabase
      .from('impact_donations')
      .select('user_id, amount')

    if (!donations || donations.length === 0) {
      return NextResponse.json({ leaderboard: [] })
    }

    // Aggregate by user
    const totals: Record<string, number> = {}
    for (const d of donations) {
      if (!d.user_id) continue
      totals[d.user_id] = (totals[d.user_id] ?? 0) + Number(d.amount)
    }

    const userIds = Object.keys(totals)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, created_at')
      .in('id', userIds)

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]))

    const leaderboard = userIds
      .map(uid => ({
        user_id: uid,
        full_name: profileMap[uid]?.full_name ?? 'Anonymous',
        avatar_url: profileMap[uid]?.avatar_url ?? null,
        donated: totals[uid],
        is_founder: !!(profileMap[uid]?.created_at && new Date(profileMap[uid].created_at) < new Date('2026-05-01')),
      }))
      .sort((a, b) => b.donated - a.donated)
      .slice(0, 10)
      .map((m, i) => ({ ...m, rank: i + 1 }))

    return NextResponse.json({ leaderboard })
  } catch (err) {
    console.error('[GET /api/impact/leaderboard]', err)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
