import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    // Only select columns that actually exist on profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, bio, location')
      .not('full_name', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/directory/members]', error)
      return NextResponse.json({ members: [] })
    }

    // Fetch trust balances separately (lives in trust_balances table)
    const ids = (data ?? []).map((p: { id: string }) => p.id)
    const { data: balances } = ids.length > 0
      ? await supabase.from('trust_balances').select('user_id, balance').in('user_id', ids)
      : { data: [] as { user_id: string; balance: number }[] }

    const balanceMap: Record<string, number> = {}
    ;(balances ?? []).forEach((b: { user_id: string; balance: number }) => {
      balanceMap[b.user_id] = b.balance
    })

    const members = (data ?? []).map((p: {
      id: string; full_name: string | null; username: string | null
      avatar_url: string | null; bio: string | null; location: string | null
    }) => ({
      id: p.id,
      type: 'individual' as const,
      full_name: p.full_name ?? null,
      username: p.username ?? null,
      avatar_url: p.avatar_url ?? null,
      bio: p.bio ?? null,
      location: p.location ?? null,
      trust_balance: balanceMap[p.id] ?? 0,
      follower_count: 0,
      skills: [] as string[],
    }))

    return NextResponse.json({ members })
  } catch (err) {
    console.error('[GET /api/directory/members] unexpected error:', err)
    return NextResponse.json({ members: [] })
  }
}
