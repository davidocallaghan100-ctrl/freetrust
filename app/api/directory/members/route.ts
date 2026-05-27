export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ────────────────────────────────────────────────────────────────────────────
// GET /api/directory/members
// ────────────────────────────────────────────────────────────────────────────
//
// SOURCE OF TRUTH: `public.profiles`.
//
// The directory is built EXCLUSIVELY from visible rows in the profiles table.
// It must never read from auth.users or create profiles as a side effect of a
// GET request. Profile creation belongs to the Supabase auth trigger
// (`public.handle_new_user`), not this read endpoint; otherwise deleted users
// can be resurrected the next time someone opens /members.
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
  verification_badges_fetched: number
  verification_badges_error: string | null
  // Deprecated backfill counters retained for diagnostics/client compatibility.
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
    verification_badges_fetched: 0,
    verification_badges_error: null,
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

  // ── STEP 1. Fetch all visible profiles — the single source of truth ──────
  // This is the ONLY query that determines who appears in the directory.
  // Soft-deleted profiles (`deleted_at` set) must remain hidden everywhere.
  //
  // NOTE: the select string MUST be a single string literal (no `+`
  // concatenation). Supabase's typed client infers the row type from the
  // literal type of this argument; concatenating with `+` collapses it to
  // plain `string` and the return type degrades to `GenericStringError`,
  // which then breaks every `.id` / `.full_name` access below with
  // TS2345 errors. Keep it on one line.
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, bio, location, role, created_at, is_verified, verified_at, verification_status, professional_headline, linkedin_url, instagram_url, twitter_url, github_url, tiktok_url, youtube_url, website_url')
    .is('deleted_at', null)
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
  const verificationBadgeMap: Record<string, { status: string; verified_at: string | null }> = {}

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

    try {
      const { data: badges, error: badgesErr } = await supabase
        .from('profile_verification_badges')
        .select('user_id, status, verified_at')
        .in('user_id', ids)
      if (badgesErr) {
        console.warn('[GET /api/directory/members] profile_verification_badges query error:', badgesErr.message)
        diag.verification_badges_error = badgesErr.message
      } else {
        for (const b of (badges ?? []) as { user_id: string; status: string; verified_at: string | null }[]) {
          verificationBadgeMap[b.user_id] = { status: b.status, verified_at: b.verified_at }
        }
        diag.verification_badges_fetched = Object.keys(verificationBadgeMap).length
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[GET /api/directory/members] profile_verification_badges threw:', msg)
      diag.verification_badges_error = msg
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
      is_verified?: boolean | null
      verified_at?: string | null
      verification_status?: string | null
      professional_headline?: string | null
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
      is_verified: verificationBadgeMap[p.id]?.status === 'verified',
      verified_at: verificationBadgeMap[p.id]?.verified_at ?? null,
      verification_status: verificationBadgeMap[p.id]?.status ?? null,
      profile_verification_status: verificationBadgeMap[p.id]?.status ?? null,
      profile_identity_verified_at: verificationBadgeMap[p.id]?.verified_at ?? null,
      professional_headline: p.professional_headline ?? null,
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

  // No auth.users backfill here. The former implementation listed auth users
  // and upserted missing profile rows on every read, which resurrected deleted
  // accounts. New profiles are created by the `public.handle_new_user` trigger.

  diag.duration_ms = Date.now() - startedAt
  console.log(
    `[GET /api/directory/members] done: ${members.length} members ` +
    `(profiles=${diag.profiles_total}, ${diag.duration_ms}ms)`,
  )

  return NextResponse.json(
    { members, _diagnostic: diag },
    { headers: noStoreHeaders },
  )
}
