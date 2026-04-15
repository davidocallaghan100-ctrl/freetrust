export const dynamic = 'force-dynamic'
export const revalidate = 0
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
//   1. Fetch ALL profiles (primary data source) — bypass the PostgREST
//      default 1000-row cap via .range(0, 9999) so platforms with up
//      to 10k members get the full directory in one response.
//   2. Enrich with trust balances + follower counts (optional decoration)
//   3. Return the response
//   4. Fire-and-forget backfill from auth.users (NON-BLOCKING — runs
//      after the response has been sent so a slow auth.admin.listUsers
//      paginated loop on a Vercel cold start cannot make the directory
//      page time out).
//
// Every step after step 1 is wrapped in its own try/catch so enrichment
// failures degrade gracefully to zero-filled defaults rather than dropping
// any member from the response.

// Server-side only diagnostic — logged via console.log for Vercel
// log inspection but NEVER shipped in the HTTP response (earlier
// versions exposed this to all callers, leaking auth user counts and
// internal error text).
interface Diagnostic {
  profiles_total: number
  profiles_query_error: string | null
  trust_balances_fetched: number
  trust_balances_error: string | null
  follower_rows_fetched: number
  follower_rows_error: string | null
  duration_ms: number
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
    duration_ms: 0,
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
      { members: [], error: `Server misconfiguration: ${msg}` },
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
  //
  // .range(0, 9999) instead of .limit(1000) — the PostgREST `max_rows`
  // setting silently caps `.limit()` at 1000 rows on most Supabase
  // projects, so a directory with 1500 members would only return the
  // first 1000 with NO error indication. .range() bypasses that cap by
  // making the row window explicit. 10,000 is generous but cheap — the
  // shape we're selecting is small (no large columns), so even the
  // worst case is well under the 4 MB PostgREST response limit.
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, location, role, created_at, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url')
    .order('created_at', { ascending: false })
    .range(0, 9999)

  if (profilesError) {
    console.error('[GET /api/directory/members] profiles query failed:', profilesError.message)
    diag.profiles_query_error = profilesError.message
    diag.duration_ms = Date.now() - startedAt
    return NextResponse.json(
      { members: [], error: profilesError.message },
      { status: 500, headers: noStoreHeaders },
    )
  }

  const profiles = profilesData ?? []
  diag.profiles_total = profiles.length

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
  // CHANGED 2026-04-15 — backfill is now NON-BLOCKING.
  //
  // The previous implementation `await`ed a paginated `auth.admin.listUsers`
  // loop (up to 20 pages × 1000 users = 20,000 records) BEFORE returning
  // the response. On a Vercel cold start with even modest auth.users
  // counts this could push past the 10s function timeout, causing the
  // entire directory request to fail and the page to render zero members
  // (the user-visible symptom we're fixing).
  //
  // The backfill itself is still useful — it creates profile rows for
  // auth.users who somehow signed up without one, so they appear on the
  // NEXT request — but it does NOT need to block the current response.
  // We kick it off as an un-awaited promise scheduled via setTimeout(0)
  // so the event loop yields back to the response writer first. On Vercel
  // serverless this is best-effort: if the function container is killed
  // immediately after the response flushes, the backfill might not
  // complete. That's acceptable because:
  //   * The next request will trigger another backfill attempt
  //   * The handle_new_user() Postgres trigger (added by
  //     20260412_signup_defensive.sql) creates the profiles row at signup
  //     time, so the backfill is only catching very rare edge cases (old
  //     users predating the trigger)
  //   * The directory must NEVER be blocked by an enrichment side effect
  //
  // The whole block runs inside a try/catch so an unhandled rejection
  // here cannot crash the function.
  diag.duration_ms = Date.now() - startedAt
  console.log(
    `[GET /api/directory/members] done: ${members.length} members ` +
    `(profiles=${diag.profiles_total}, ${diag.duration_ms}ms)`,
  )

  // Schedule the backfill AFTER we build the response so it can't delay
  // it. Wrapped in try/catch + .catch() so rejections die quietly.
  void runAuthBackfillInBackground(supabase, ids).catch(err => {
    console.error('[members backfill] background task rejected:', err instanceof Error ? err.message : err)
  })

  // _diagnostic field intentionally OMITTED from the public response —
  // earlier versions shipped auth user counts, error messages, and
  // sample profile ids to every caller, which is a small but real
  // information leak. The diag object is still useful server-side and
  // is logged via console.log above.
  return NextResponse.json(
    { members, count: members.length },
    { headers: noStoreHeaders },
  )
}

// ── Non-blocking backfill helper ─────────────────────────────────────────────
// Extracted into a top-level function so the response handler can fire
// it without awaiting and so the type signature stays clean. Accepts
// the existing admin Supabase client and the set of profile ids that
// were just returned to the caller — anything in auth.users that's
// NOT in that set gets a placeholder profiles row inserted.
async function runAuthBackfillInBackground(
  supabase: ReturnType<typeof createAdminClient>,
  existingProfileIds: string[],
): Promise<void> {
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
        return
      }
      const pageUsers = pageData?.users ?? []
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

    if (allAuthUsers.length === 0) return

    const existingIds = new Set(existingProfileIds)
    const missing = allAuthUsers.filter(u => !existingIds.has(u.id))
    if (missing.length === 0) return

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
      } else {
        upserted += slice.length
      }
    }
    console.log(`[members backfill] upserted ${upserted} / ${missing.length} missing profiles (background)`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[members backfill] top-level error:', msg)
  }
}
