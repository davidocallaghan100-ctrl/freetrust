// ────────────────────────────────────────────────────────────────────────────
// Central catalogue of TrustCoin (₮) reward amounts
// ────────────────────────────────────────────────────────────────────────────
//
// Every trust-awarding code path in the app must reference a constant
// from this file instead of hardcoding a number. Centralising the values
// here means:
//
//   1. Changing an award amount is a one-line edit, not a hunt through
//      10+ route files.
//   2. The earning schedule is auditable — one file, grep-able from
//      the UI side (e.g. the wallet "how to earn" section can import
//      the same constants and render them).
//   3. Consistency — a listing creator gets the same ₮ whether they
//      publish via /api/listings or /api/create/publish. Before this
//      file existed, those two paths could drift out of sync (and
//      in fact drifted all the way to ONE of them awarding nothing,
//      which is how Cliff's missing coins happened).
//
// Values here reflect the product spec as of the pre-launch audit.
// All integers — ₮ is a whole-number currency (no fractional tokens).
export const TRUST_REWARDS = {
  // ── Signup + profile ─────────────────────────────────────────────
  SIGNUP_BONUS:      200,  // Welcome grant on first signup
  COMPLETE_PROFILE:  50,   // Profile hits 100% completeness
  REFER_USER:        150,  // Successful referral (new user signs up via link)

  // ── Creation (marketplace) ───────────────────────────────────────
  CREATE_LISTING:    50,   // Product listing created (fallback/alias)
  CREATE_SERVICE:    50,   // Service gig published
  CREATE_PRODUCT:    50,   // Physical/digital product listed
  CREATE_JOB:        30,   // Job posted
  CREATE_EVENT:      50,   // Event created
  PUBLISH_ARTICLE:   75,   // Article published

  // ── Community ────────────────────────────────────────────────────
  CREATE_COMMUNITY:  100,  // User creates a new community
  JOIN_COMMUNITY:    20,   // User joins an existing community
  RSVP_EVENT:        10,   // User RSVPs to an event

  // ── Transactions ─────────────────────────────────────────────────
  COMPLETE_ORDER:    100,  // Order marked complete (seller side)
  LEAVE_REVIEW:      10,   // User leaves a review on an order
  RECEIVE_REVIEW:    25,   // User receives a review (from their counterparty)

  // ── Engagement ───────────────────────────────────────────────────
  DONATE_IMPACT:     2,    // User donates to the Sustainability Fund (per donation)
  POST_LIKED:        2,    // User's feed post receives a like
} as const

// Type of valid reward keys — used by awardTrust() for autocomplete
// and to prevent typos like `TRUST_REWARDS.CREATE_LSTING`.
export type TrustRewardKey = keyof typeof TRUST_REWARDS

// ── Ledger type strings ─────────────────────────────────────────────
// The `type` column on trust_ledger is a short stable slug that
// represents "what action earned this ₮". Kept here so the
// wallet history view and any future analytics can filter by a
// known set of strings instead of ad-hoc values scattered across
// routes.
export const TRUST_LEDGER_TYPES = {
  SIGNUP_BONUS:     'signup_bonus',
  COMPLETE_PROFILE: 'profile_complete',
  REFER_USER:       'refer_member',

  CREATE_SERVICE:   'create_service',
  CREATE_PRODUCT:   'create_product',
  CREATE_JOB:       'create_job',
  CREATE_EVENT:     'create_event',
  PUBLISH_ARTICLE:  'publish_article',

  CREATE_COMMUNITY: 'create_community',
  JOIN_COMMUNITY:   'join_community',
  RSVP_EVENT:       'rsvp_event',

  COMPLETE_ORDER:   'complete_order',
  LEAVE_REVIEW:     'leave_review',
  RECEIVE_REVIEW:   'receive_review',

  DONATE_IMPACT:    'donate_impact',
  POST_LIKED:       'post_liked',

  // ── Delivery-weighted rewards (Week 2) ───────────────────────────
  DELIVERED_ON_TIME: 'delivered_on_time',
  DELIVERED_LATE:    'delivered_late',
  BUYER_CONFIRMED:   'buyer_confirmed',
  FIVE_STAR_BONUS:   'five_star_review',
  DISPUTE_LOST:      'dispute_lost',
  TRACKING_USED:     'tracking_used',
} as const

export type TrustLedgerType = typeof TRUST_LEDGER_TYPES[keyof typeof TRUST_LEDGER_TYPES]

// ── Delivery reward amounts ──────────────────────────────────────────
// Separate from TRUST_REWARDS so they are clearly labelled as
// delivery-quality signals rather than activity rewards.
export const DELIVERY_TRUST_REWARDS = {
  DELIVERED_ON_TIME: 150,   // Seller — arrived on or before expected date
  DELIVERED_LATE:     50,   // Seller — arrived but after expected date (still rewarded)
  BUYER_CONFIRMED:    25,   // Buyer  — confirmed receipt (encourages fast confirmation)
  FIVE_STAR_BONUS:    25,   // Reviewer — bonus on top of LEAVE_REVIEW for a 5-star
  DISPUTE_LOST:      -50,   // Seller — deducted when dispute resolved against them
  TRACKING_USED:      10,   // Seller — started live delivery tracking (adoption incentive)
} as const
