export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Structured diagnostic info returned in the response body. Surfaced in the
// browser Network tab as JSON so issues can be debugged without SSH access
// to Vercel logs. `members` is the render data; `_diagnostic` is for
// debugging only and can be ignored by callers.
interface Diagnostic {
  auth_users_fetched: number
  auth_users_pages_fetched: number
  profiles_existing: number
  profiles_missing: number
  profiles_upserted: number
  profiles_upsert_error: string | null
  profiles_total_after: number
  duration_ms: number
}

export async function GET() {
  const startedAt = Date.now()
  const diag: Diagnostic = {
    auth_users_fetched: 0,
    auth_users_pages_fetched: 0,
    profiles_existing: 0,
    profiles_missing: 0,
    profiles_upserted: 0,
    profiles_upsert_error: null,
    profiles_total_after: 0,
    duration_ms: 0,
  }

  try {
    const supabase = createAdminClient()

    // ── Backfill missing profiles from auth.users ──────────────────────────
    // Bug fix (42a9902 was incomplete): supabase.auth.admin.listUsers() is
    // paginated and only returns one page at a time. The previous version
    // fetched perPage: 1000 and assumed that covered everything. If the
    // project has more than 1000 users, OR if the default sort order is
    // created_at ASC (oldest first), newer users were never checked and
    // never backfilled.
    //
    // Fix: iterate through every page until listUsers returns an empty
    // page, collecting all user ids. Cap at 20 pages (20,000 users) as
    // a safety net against runaway loops.
    try {
      const allAuthUsers: Array<{ id: string; email: string | null; user_metadata: Record<string, unknown> | null }> = []
      const PER_PAGE = 1000
      const MAX_PAGES = 20

      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data: pageData, error: pageErr } = await supabase.auth.admin.listUsers({
          page,
          perPage: PER_PAGE,
        })
        if (pageErr) {
          console.error(`[members backfill] listUsers page=${page} error:`, pageErr.message)
          break
        }
        const pageUsers = pageData?.users ?? []
        diag.auth_users_pages_fetched = page
        if (pageUsers.length === 0) break
        for (const u of pageUsers) {
          allAuthUsers.push({
            id: u.id,
            email: u.email ?? null,
            user_metadata: (u.user_metadata as Record<string, unknown> | null) ?? null,
          })
        }
        // Last page — stop iterating
        if (pageUsers.length < PER_PAGE) break
      }

      diag.auth_users_fetched = allAuthUsers.length
      console.log(`[members backfill] auth users total: ${allAuthUsers.length} across ${diag.auth_users_pages_fetched} page(s)`)

      if (allAuthUsers.length > 0) {
        // Fetch the existing profile ids for THIS set of auth users
        const authIds = allAuthUsers.map(u => u.id)

        // Supabase's .in() can handle ~1000 values comfortably but struggles
        // past that. Chunk the existence check so large user bases work.
        const existingIds = new Set<string>()
        const CHUNK = 500
        for (let i = 0; i < authIds.length; i += CHUNK) {
          const slice = authIds.slice(i, i + CHUNK)
          const { data: existing, error: existErr } = await supabase
            .from('profiles')
            .select('id')
            .in('id', slice)
          if (existErr) {
            console.error(`[members backfill] profiles existence check error:`, existErr.message)
            continue
          }
          for (const row of existing ?? []) {
            existingIds.add((row as { id: string }).id)
          }
        }

        diag.profiles_existing = existingIds.size
        const missing = allAuthUsers.filter(u => !existingIds.has(u.id))
        diag.profiles_missing = missing.length

        console.log(`[members backfill] existing profiles: ${existingIds.size}, missing: ${missing.length}`)

        if (missing.length > 0) {
          const rows = missing.map(u => ({
            id: u.id,
            email: u.email ?? `${u.id}@placeholder.local`,
            full_name:
              (u.user_metadata?.full_name as string | undefined) ??
              (u.user_metadata?.name as string | undefined) ??
              null,
          }))

          // Chunk the upsert too — some Postgres drivers bail on very large
          // VALUES lists.
          let totalUpserted = 0
          for (let i = 0; i < rows.length; i += CHUNK) {
            const slice = rows.slice(i, i + CHUNK)
            const { error: upsertErr } = await supabase
              .from('profiles')
              .upsert(slice, { onConflict: 'id', ignoreDuplicates: true })
            if (upsertErr) {
              console.error(`[members backfill] upsert chunk ${i}..${i + slice.length} error:`, upsertErr.message)
              diag.profiles_upsert_error = upsertErr.message
            } else {
              totalUpserted += slice.length
            }
          }
          diag.profiles_upserted = totalUpserted
          console.log(`[members backfill] upserted ${totalUpserted} / ${missing.length} missing profile rows`)
        }
      }
    } catch (backfillErr) {
      const msg = backfillErr instanceof Error ? backfillErr.message : String(backfillErr)
      console.error('[members backfill] top-level error:', msg)
      diag.profiles_upsert_error = msg
    }

    // ── Fetch all profiles ──────────────────────────────────────────────────
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, bio, location, role, created_at, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('[GET /api/directory/members] query error:', error.message)
      return NextResponse.json(
        { members: [], error: error.message, _diagnostic: { ...diag, duration_ms: Date.now() - startedAt } },
        {
          status: 500,
          headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
        }
      )
    }

    diag.profiles_total_after = data?.length ?? 0
    diag.duration_ms = Date.now() - startedAt

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
      linkedin_url?: string | null; instagram_url?: string | null
      twitter_url?: string | null; github_url?: string | null
      tiktok_url?: string | null; youtube_url?: string | null
      website_url?: string | null
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
      // Social links — passed straight through. Empty strings/nulls are
      // hidden by the SocialLinks component on the client.
      linkedin_url:  p.linkedin_url  ?? null,
      instagram_url: p.instagram_url ?? null,
      twitter_url:   p.twitter_url   ?? null,
      github_url:    p.github_url    ?? null,
      tiktok_url:    p.tiktok_url    ?? null,
      youtube_url:   p.youtube_url   ?? null,
      website_url:   p.website_url   ?? null,
    }))

    console.log(`[GET /api/directory/members] done: ${members.length} members, ${diag.profiles_upserted} backfilled, ${diag.duration_ms}ms`)

    return NextResponse.json(
      { members, _diagnostic: diag },
      {
        // Prevent browser + CDN + service worker caching so new signups
        // show up the moment they appear in the profiles table. Mobile
        // Safari caches GETs aggressively without this header.
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/directory/members] unexpected error:', msg, err)
    diag.duration_ms = Date.now() - startedAt
    return NextResponse.json(
      { members: [], error: msg, _diagnostic: diag },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    )
  }
}
