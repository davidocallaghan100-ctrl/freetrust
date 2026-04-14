// ────────────────────────────────────────────────────────────────────────────
// Organisations trust-score calculator
// ────────────────────────────────────────────────────────────────────────────
// Replaces the static `organisations.trust_score` integer column with a
// calculated 0–100 score derived from real signals. The DB column had no
// recalculation logic anywhere in the app — fresh orgs were hardcoded to
// 0 by the POST insert and any non-zero values on existing rows were
// manually set to 100 in the Supabase dashboard, which is why the UI
// showed a binary 0/100 distribution.
//
// Scoring model:
//
//   BASE                   25   given to every org that exists
//   Has description        +5   (description non-empty)
//   Has cover photo        +5   (cover_url non-empty)
//   Has category           +5   (type non-empty)
//   Verified badge        +15
//   Member growth      up to 20  (sqrt(members - 1) * 8, capped)
//   Follower count     up to 15  (sqrt(followers) * 3, capped)
//   Average rating     up to 25  (avg_rating * 5, so 5★ = 25; only when
//                                 reviewCount > 0)
//   Tenure             up to 10  (ageMonths, capped — 1 pt per month)
//
// Total is clamped to 100. New orgs land between 25 (bare minimum) and
// ~55 (fully-filled profile, no community yet) so they no longer show
// ₮0 on the directory — fixes the "binary 0/100 distribution" complaint.
//
// All weights are negotiable — bump the constants below if a particular
// signal should matter more.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface TrustScoreSignals {
  isVerified:     boolean
  hasDescription: boolean
  hasCover:       boolean
  hasCategory:    boolean
  memberCount:    number
  followerCount:  number
  reviewCount:    number
  avgRating:      number   // 0–5 (raw rating average from organisation_reviews)
  ageMonths:      number
}

const BASE              = 25
const DESCRIPTION_PTS   = 5
const COVER_PTS         = 5
const CATEGORY_PTS      = 5
const VERIFIED          = 15
const MEMBER_CAP        = 20
const FOLLOWER_CAP      = 15
const RATING_CAP        = 25
const TENURE_CAP        = 10

/**
 * Pure 0-100 trust score from a set of signals. Returns a rounded
 * integer so the UI doesn't render half-points.
 *
 * Every org starts from BASE (25). Layered bonuses then add up to a
 * maximum of 100. Missing signals never subtract — a brand-new org
 * with no reviews / followers / members just doesn't earn those
 * specific bonuses and sits at 25–55 depending on profile completeness.
 *
 * Edge cases:
 *   * NaN / negative inputs are clamped to 0 before being used
 *   * Empty review history → 0 contribution from the rating term
 *     (i.e. a brand-new org isn't punished for not having reviews,
 *     it just doesn't earn that 25 points yet)
 */
export function computeOrgTrustScore(s: TrustScoreSignals): number {
  const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

  // 1. Base score — given to every org that exists. Prevents the UI
  //    "₮0 for brand-new orgs" embarrassment.
  const basePts = BASE

  // 2. Profile completeness — three independent 5-pt bonuses. Matches
  //    the POST handler's validation (description is required; cover
  //    and category are optional but strongly encouraged).
  const descriptionPts = s.hasDescription ? DESCRIPTION_PTS : 0
  const coverPts       = s.hasCover       ? COVER_PTS       : 0
  const categoryPts    = s.hasCategory    ? CATEGORY_PTS    : 0

  // 3. Verified badge — proof the org passed manual review
  const verifiedPts = s.isVerified ? VERIFIED : 0

  // 4. Member growth — sqrt curve so going from 1→2 members is rewarded
  //    more than going from 50→51. memberCount - 1 because the creator
  //    auto-counts as 1 and shouldn't earn points on their own.
  const memberPts = Math.min(MEMBER_CAP, Math.sqrt(safe(s.memberCount - 1)) * 8)

  // 5. Followers — same sqrt curve, gentler slope
  const followerPts = Math.min(FOLLOWER_CAP, Math.sqrt(safe(s.followerCount)) * 3)

  // 6. Reviews — only earn points if there's at least one review.
  //    25-point cap means a 5★ average fills the whole term.
  const ratingPts = s.reviewCount > 0
    ? Math.min(RATING_CAP, Math.max(0, s.avgRating) * 5)
    : 0

  // 7. Tenure — 1 point per month, capped at 10
  const tenurePts = Math.min(TENURE_CAP, safe(s.ageMonths))

  const total =
    basePts +
    descriptionPts + coverPts + categoryPts +
    verifiedPts +
    memberPts +
    followerPts +
    ratingPts +
    tenurePts

  return Math.round(Math.min(100, Math.max(0, total)))
}

// ────────────────────────────────────────────────────────────────────────────
// Signal collection — batched for the list endpoint, single-shot for detail
// ────────────────────────────────────────────────────────────────────────────

interface OrgRow {
  id: string
  logo_url?: string | null
  cover_url?: string | null
  description?: string | null
  type?: string | null           // org category / type slug
  is_verified?: boolean | null
  members_count?: number | null
  member_count?: number | null   // schema mismatch tolerance — accept either
  follower_count?: number | null
  created_at?: string | null
}

function ageMonthsFromCreatedAt(created_at: string | null | undefined): number {
  if (!created_at) return 0
  const ms = Date.now() - new Date(created_at).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return ms / (1000 * 60 * 60 * 24 * 30.44)  // average month length
}

function memberCountFromRow(o: OrgRow): number {
  // The live DB schema is inconsistent — the .sql file says `member_count`
  // but the app code reads `members_count`. Accept either so we don't
  // need a separate migration to land this fix.
  return o.members_count ?? o.member_count ?? 0
}

/**
 * Fetch the per-org signals needed to compute trust scores for an
 * arbitrary set of organisations. Runs two batched queries (reviews and
 * followers) in parallel — this scales fine up to a few hundred orgs and
 * avoids the N+1 trap of fetching per-org.
 *
 * Returns a Map keyed by organisation id so callers can look up signals
 * by row.id.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collectTrustSignalsForOrgs(supabase: SupabaseClient<any, any, any>, orgs: OrgRow[]): Promise<Map<string, TrustScoreSignals>> {
  const map = new Map<string, TrustScoreSignals>()
  if (orgs.length === 0) return map

  const orgIds = orgs.map(o => o.id)

  // Two batched queries in parallel. Tolerate failures on either: a missing
  // table or RLS denial just means the corresponding signal contributes 0,
  // which is safer than 500-ing the entire org list endpoint.
  const [reviewsRes, followersRes] = await Promise.allSettled([
    supabase
      .from('organisation_reviews')
      .select('organisation_id, rating')
      .in('organisation_id', orgIds),
    supabase
      .from('organisation_followers')
      .select('organisation_id')
      .in('organisation_id', orgIds),
  ])

  // Aggregate reviews → {avgRating, reviewCount} per org
  const reviewAgg = new Map<string, { sum: number; count: number }>()
  if (reviewsRes.status === 'fulfilled' && reviewsRes.value.data) {
    for (const r of reviewsRes.value.data as Array<{ organisation_id: string; rating: number }>) {
      const cur = reviewAgg.get(r.organisation_id) ?? { sum: 0, count: 0 }
      cur.sum += r.rating ?? 0
      cur.count += 1
      reviewAgg.set(r.organisation_id, cur)
    }
  }

  // Aggregate followers → count per org
  const followerCount = new Map<string, number>()
  if (followersRes.status === 'fulfilled' && followersRes.value.data) {
    for (const f of followersRes.value.data as Array<{ organisation_id: string }>) {
      followerCount.set(f.organisation_id, (followerCount.get(f.organisation_id) ?? 0) + 1)
    }
  }

  for (const o of orgs) {
    const ra = reviewAgg.get(o.id)
    map.set(o.id, {
      isVerified:     Boolean(o.is_verified),
      hasDescription: Boolean((o.description ?? '').trim()),
      hasCover:       Boolean((o.cover_url ?? '').trim()),
      hasCategory:    Boolean((o.type ?? '').trim()),
      memberCount:    memberCountFromRow(o),
      // Prefer a per-row follower_count column if present (faster, no
      // batched query needed), but fall back to the counted query.
      followerCount:  o.follower_count ?? followerCount.get(o.id) ?? 0,
      reviewCount:    ra?.count ?? 0,
      avgRating:      ra && ra.count > 0 ? ra.sum / ra.count : 0,
      ageMonths:      ageMonthsFromCreatedAt(o.created_at),
    })
  }

  return map
}

/**
 * Single-org variant. Same signal sources as collectTrustSignalsForOrgs
 * but optimised for the detail endpoint.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function collectTrustSignalsForOrg(supabase: SupabaseClient<any, any, any>, org: OrgRow): Promise<TrustScoreSignals> {
  const m = await collectTrustSignalsForOrgs(supabase, [org])
  return m.get(org.id) ?? {
    isVerified: false,
    hasDescription: false,
    hasCover: false,
    hasCategory: false,
    memberCount: 0,
    followerCount: 0,
    reviewCount: 0,
    avgRating: 0,
    ageMonths: 0,
  }
}
