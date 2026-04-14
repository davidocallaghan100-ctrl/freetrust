export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ────────────────────────────────────────────────────────────────────────────
// GET /api/directory/members
// ────────────────────────────────────────────────────────────────────────────
//
// SOURCE OF TRUTH: `public.profiles`.
//
// The directory is built EXCLUSIVELY from rows in the profiles table. There
// is no join with auth.users anywhere in this route, and no step in this
// route can filter rows OUT of the profiles query's result. If a row exists
// in profiles, it will appear in this endpoint's response — full stop.
//
// This was an important fix after a bug where members signed up via
// alternate auth paths (OAuth / Google) ended up with profile rows whose
// `id` no longer existed in auth.users. The route used to (effectively)
// gate visibility on auth.users membership, dropping those users. The
// structure below isolates the profiles read from everything else so that
// bug cannot regress:
//
//   1. Fetch ALL profiles (primary data source)
//   2. Enrich with trust balances + follower counts (optional decoration)
//   3. Fire-and-forget backfill from auth.users (optional side effect,
//      does not run before step 1, cannot affect the response)
//
// Every step after step 1 is wrapped in its own try/catch so enrichment
// failures degrade gracefully to zero-filled defaults rather than dropping
// any member from the response.

interface Diagnostic {
  // Profiles query — the only thing that matters for visibility.
  profiles_total: number
  profiles_query_error: string | null
  // Decoration steps — non-fatal.
  trust_balances_fetched: number
  trust_balances_error: string | null
  follower_rows_fetched: number
  follower_rows_error: string | null
  // Backfill side-effect — runs AFTER the response data is ready, so
  // failures here are purely cosmetic for the NEXT request.
  auth_users_fetched: number
  auth_users_pages_fetched: number
  profiles_missing: number
  profiles_upserted: number
  backfill_error: string | null
  // Timing + sample evidence so a single response tells us whether a
  // specific user (e.g. Fergus, Mags) is present in the result.
  duration_ms: number
  // First 50 profile ids returned — included so the next bug report can
  // confirm whether a specific user is present in the raw query output
  // without needing Vercel log access. Capped at 50 to keep the
  // response size sane.
  profile_ids_sample: string[]
}

export async function GET() {
  const startedAt = Date.now()
  const diag: Diagnostic = {
    profiles_total: 0,
    profiles_query_error: null,
    trust_balances_fetched: 0,
    trust_balances_error: null,
    follower_rows_fetched: 0,
    follower_rows_error: null,
    auth_users_fetched: 0,
    auth_users_pages_fetched: 0,
    profiles_missing: 0,
    profiles_upserted: 0,
    backfill_error: null,
    duration_ms: 0,
    profile_ids_sample: [],
  }

  // Always returned, even on error, so the client can react.
  const noStoreHeaders = {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/directory/members] createAdminClient threw:', msg)
    diag.duration_ms = Date.now() - startedAt
    return NextResponse.json(
      { members: [], error: `Server misconfiguration: ${msg}`, _diagnostic: diag },
      { status: 500, headers: noStoreHeaders },
    )
  }

  // ── STEP 1. Fetch ALL profiles — the single source of truth ──────────────
  // This is the ONLY query that determines who appears in the directory.
  // No filters. No joins. No WHERE clause. Just every row in profiles,
  // newest first. If this returns 13 rows, the response has 13 members.
  //
  // NOTE: the select string MUST be a single string literal (no `+`
  // concatenation). Supabase's typed client infers the row type from the
  // literal type of this argument; concatenating with `+` collapses it to
  // plain `string` and the return type degrades to `GenericStringError`,
  // which then breaks every `.id` / `.full_name` access below with
  // TS2345 errors. Keep it on one line.
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, location, role, created_at, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (profilesError) {
    console.error('[GET /api/directory/members] profiles query failed:', profilesError.message)
    diag.profiles_query_error = profilesError.message
    diag.duration_ms = Date.now() - startedAt
    return NextResponse.json(
      { members: [], error: profilesError.message, _diagnostic: diag },
      { status: 500, headers: noStoreHeaders },
    )
  }

  const profiles = profilesData ?? []
  diag.profiles_total = profiles.length
  diag.profile_ids_sample = profiles.slice(0, 50).map((p: { id: string }) => p.id)

  console.log(`[GET /api/directory/members] profiles query returned ${profiles.length} rows`)

  // ── STEP 2. Enrich with trust balances + follower counts ─────────────────
  // Non-fatal decoration — wrapped in its own try/catch so any failure
  // here produces zero-filled defaults rather than dropping members from
  // the response. The `ids` passed to .in(...) are profile ids from
  // STEP 1, so there is no way for the enrichment step to cause a member
  // from profiles to disappear from the response.
  const ids = profiles.map((p: { id: string }) => p.id)
  const balanceMap: Record<string, number> = {}
  const followerMap: Record<string, number> = {}

  if (ids.length > 0) {
    try {
      const { data: balances, error: balancesErr } = await supabase
        .from('trust_balances')
        .select('user_id, balance')
        .in('user_id', ids)
      if (balancesErr) {
        console.error('[GET /api/directory/members] trust_balances query error:', balancesErr.message)
        diag.trust_balances_error = balancesErr.message
      } else {
        for (const b of (balances ?? []) as { user_id: string; balance: number }[]) {
          balanceMap[b.user_id] = b.balance
        }
        diag.trust_balances_fetched = Object.keys(balanceMap).length
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/directory/members] trust_balances threw:', msg)
      diag.trust_balances_error = msg
    }

    try {
      const { data: follows, error: followsErr } = await supabase
        .from('user_follows')
        .select('following_id')
        .in('following_id', ids)
      if (followsErr) {
        console.error('[GET /api/directory/members] user_follows query error:', followsErr.message)
        diag.follower_rows_error = followsErr.message
      } else {
        for (const f of (follows ?? []) as { following_id: string }[]) {
          followerMap[f.following_id] = (followerMap[f.following_id] ?? 0) + 1
        }
        diag.follower_rows_fetched = (follows ?? []).length
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[GET /api/directory/members] user_follows threw:', msg)
      diag.follower_rows_error = msg
    }
  }

  // ── STEP 3. Shape the response. Every row from STEP 1 makes it in. ───────
  const members = profiles.map((raw) => {
    const p = raw as {
      id: string
      full_name: string | null
      avatar_url: string | null
      bio: string | null
      location: string | null
      role: string | null
      created_at: string
      linkedin_url?: string | null
      instagram_url?: string | null
      twitter_url?: string | null
      github_url?: string | null
      tiktok_url?: string | null
      youtube_url?: string | null
      website_url?: string | null
    }
    return {
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
    }
  })

  // ── STEP 4. Fire-and-forget backfill from auth.users ─────────────────────
  // IMPORTANT — this runs AFTER the response data is ready. It cannot
  // affect `members` above. Its only purpose is to create profile rows
  // for auth.users who don't have one yet, so they appear on the NEXT
  // request. Errors here are logged into `_diagnostic.backfill_error`
  // and never fail the response.
  //
  // This is deliberately awaited (rather than truly fire-and-forget) so
  // that the response is atomic — a user refreshing rapidly after a
  // signup gets the backfill before the second request's profiles
  // query runs. We could kick it off as a non-awaited Promise but
  // serverless function containers can die the instant the response
  // flushes, killing an un-awaited side effect mid-flight.
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
        diag.backfill_error = pageErr.message
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
      if (pageUsers.length < PER_PAGE) break
    }

    diag.auth_users_fetched = allAuthUsers.length

    if (allAuthUsers.length > 0) {
      // Build a set of existing profile ids from STEP 1's result — no
      // extra query needed. This is the "profiles is the source of
      // truth" invariant: we use what the profiles query already told
      // us, rather than re-querying profiles with a filter.
      const existingIds = new Set(ids)
      const missing = allAuthUsers.filter(u => !existingIds.has(u.id))
      diag.profiles_missing = missing.length

      if (missing.length > 0) {
        const rows = missing.map(u => ({
          id: u.id,
          email: u.email ?? `${u.id}@placeholder.local`,
          full_name:
            (u.user_metadata?.full_name as string | undefined) ??
            (u.user_metadata?.name as string | undefined) ??
            null,
        }))

        // Chunk the upsert — some Postgres drivers bail on very large VALUES.
        const CHUNK = 500
        let upserted = 0
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK)
          const { error: upsertErr } = await supabase
            .from('profiles')
            .upsert(slice, { onConflict: 'id', ignoreDuplicates: true })
          if (upsertErr) {
            console.error(`[members backfill] upsert chunk ${i}..${i + slice.length} error:`, upsertErr.message)
            diag.backfill_error = upsertErr.message
          } else {
            upserted += slice.length
          }
        }
        diag.profiles_upserted = upserted
        console.log(`[members backfill] upserted ${upserted} / ${missing.length} missing profiles`)
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[members backfill] top-level error:', msg)
    diag.backfill_error = msg
  }

  diag.duration_ms = Date.now() - startedAt
  console.log(
    `[GET /api/directory/members] done: ${members.length} members ` +
    `(profiles=${diag.profiles_total}, auth=${diag.auth_users_fetched}, ` +
    `backfilled=${diag.profiles_upserted}, ${diag.duration_ms}ms)`,
  )

  return NextResponse.json(
    { members, _diagnostic: diag },
    { headers: noStoreHeaders },
  )
}
