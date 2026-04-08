import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/collab/people?q=&min_trust=0&location=&online=false&page=1
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const search = searchParams.get('q') || ''
    const minTrust = parseInt(searchParams.get('min_trust') ?? '0')
    const location = searchParams.get('location') || ''
    const onlineOnly = searchParams.get('online') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = 20
    const offset = (page - 1) * limit

    let query = supabase
      .from('profiles')
      .select(`
        id, full_name, avatar_url, bio, location, last_seen_at, role, created_at,
        trust_balances!profiles_id_fkey(balance)
      `, { count: 'exact' })
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,bio.ilike.%${search}%`)
    }
    if (location) {
      query = query.ilike('location', `%${location}%`)
    }
    if (onlineOnly) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('last_seen_at', sevenDaysAgo)
    }

    const { data: profiles, error, count } = await query

    if (error) {
      // Fallback: try without the fkey hint
      const { data: profiles2, error: error2, count: count2 } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, bio, location, last_seen_at, role, created_at', { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (error2) {
        console.error('[GET /api/collab/people]', error2)
        return NextResponse.json({ error: error2.message }, { status: 500 })
      }

      // Fetch trust balances separately
      const ids = (profiles2 ?? []).map((p: any) => p.id)
      const { data: balances } = ids.length
        ? await supabase.from('trust_balances').select('user_id, balance').in('user_id', ids)
        : { data: [] }

      const balanceMap: Record<string, number> = {}
      for (const b of balances ?? []) balanceMap[b.user_id] = b.balance

      const enriched = (profiles2 ?? []).map((p: any) => ({
        ...p,
        trust_balance: balanceMap[p.id] ?? 0,
      }))

      const filtered = enriched.filter((p: any) => p.trust_balance >= minTrust)

      return NextResponse.json({ profiles: filtered, total: count2 ?? 0, page, limit })
    }

    const filtered = (profiles ?? []).filter((p: any) => {
      const balance = Array.isArray(p.trust_balances)
        ? (p.trust_balances[0]?.balance ?? 0)
        : (p.trust_balances?.balance ?? 0)
      return balance >= minTrust
    }).map((p: any) => ({
      ...p,
      trust_balance: Array.isArray(p.trust_balances)
        ? (p.trust_balances[0]?.balance ?? 0)
        : (p.trust_balances?.balance ?? 0),
    }))

    return NextResponse.json({ profiles: filtered, total: count ?? 0, page, limit })
  } catch (err) {
    console.error('[GET /api/collab/people] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
