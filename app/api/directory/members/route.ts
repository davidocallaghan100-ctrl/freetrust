export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Fetch all registered profiles (not filtered by full_name — members
    // who haven't set a name yet will show as "Anonymous" on the card)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, location, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('[GET /api/directory/members] query error:', error.message)
      return NextResponse.json({ members: [], error: error.message }, { status: 500 })
    }

    const ids = (data ?? []).map((p: { id: string }) => p.id)

    // Fetch trust balances and follower counts in parallel
    const [balancesRes, followsRes] = await Promise.all([
      ids.length > 0
        ? supabase.from('trust_balances').select('user_id, balance').in('user_id', ids)
        : Promise.resolve({ data: [] as { user_id: string; balance: number }[] }),
      ids.length > 0
        ? supabase.from('user_follows').select('following_id').in('following_id', ids)
        : Promise.resolve({ data: [] as { following_id: string }[] }),
    ])

    const balanceMap: Record<string, number> = {}
    ;(balancesRes.data ?? []).forEach((b: { user_id: string; balance: number }) => {
      balanceMap[b.user_id] = b.balance
    })

    // Count followers per user from the raw rows (no GROUP BY needed)
    const followerMap: Record<string, number> = {}
    ;(followsRes.data ?? []).forEach((f: { following_id: string }) => {
      followerMap[f.following_id] = (followerMap[f.following_id] ?? 0) + 1
    })

    const members = (data ?? []).map((p: {
      id: string; full_name: string | null
      avatar_url: string | null; bio: string | null; location: string | null
    }) => ({
      id: p.id,
      type: 'individual' as const,
      full_name: p.full_name ?? null,
      username: null as string | null,
      avatar_url: p.avatar_url ?? null,
      bio: p.bio ?? null,
      location: p.location ?? null,
      trust_balance: balanceMap[p.id] ?? 0,
      follower_count: followerMap[p.id] ?? 0,
      skills: [] as string[],
    }))

    return NextResponse.json({ members })
  } catch (err) {
    console.error('[GET /api/directory/members] unexpected error:', err)
    return NextResponse.json({ members: [] })
  }
}
