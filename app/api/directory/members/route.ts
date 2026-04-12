export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // ── Backfill missing profiles from auth.users ──────────────────────────
    // The handle_new_user trigger may not have fired for some users. Ensure
    // every auth.user has a corresponding profiles row so they show up in
    // the directory.
    try {
      const { data: authUsersData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
      const authUsers = authUsersData?.users ?? []

      if (authUsers.length > 0) {
        const { data: existingProfiles } = await supabase
          .from('profiles')
          .select('id')
          .in('id', authUsers.map(u => u.id))

        const existingIds = new Set((existingProfiles ?? []).map((p: { id: string }) => p.id))
        const missing = authUsers.filter(u => !existingIds.has(u.id))

        if (missing.length > 0) {
          const rows = missing.map(u => ({
            id: u.id,
            email: u.email ?? `${u.id}@placeholder.local`,
            full_name:
              (u.user_metadata as Record<string, unknown> | null)?.full_name as string ??
              (u.user_metadata as Record<string, unknown> | null)?.name as string ??
              null,
          }))
          const { error: insertErr } = await supabase
            .from('profiles')
            .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
          if (insertErr) {
            console.error('[members backfill] insert error:', insertErr.message)
          } else {
            console.log(`[members backfill] created ${missing.length} missing profile rows`)
          }
        }
      }
    } catch (backfillErr) {
      // Non-fatal — continue to fetch what we have
      console.error('[members backfill] error:', backfillErr)
    }

    // ── Fetch all profiles ──────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, location, role, created_at')
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
      role: string | null; created_at: string
    }) => ({
      id: p.id,
      type: 'individual' as const,
      full_name: p.full_name ?? null,
      username: null as string | null,
      avatar_url: p.avatar_url ?? null,
      bio: p.bio ?? null,
      location: p.location ?? null,
      role: p.role ?? null,
      created_at: p.created_at,
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
