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
      .select('id, full_name, username, avatar_url, bio, location')
      .order('created_at', { ascending: false })
      .limit(1000)

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
