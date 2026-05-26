// ────────────────────────────────────────────────────────────────────────────
// Trust Economy tier ladder — single source of truth
// ────────────────────────────────────────────────────────────────────────────
//
// The 10-tier balance ladder. Previously each consumer (wallet page,
// profile page, AI assistant prompt) inlined its own getTrustLevel()
// with a slightly different ladder, which is how the old "Trusted
// Member / Verified Pro / FreeTrust Elite" names drifted out of sync.
// Every consumer now imports from here.
//
// Tiers are pure-balance progression: the higher your ₮ balance, the
// higher your tier. This is intentionally distinct from the green
// Stripe-Identity "Verified" badge (see UserVerifiedBadge.tsx), which
// is a separate trust signal. Tiers = aspirational progression in
// amber/gold. Verification = identity proof in green. The two are
// visually separable on purpose.

export interface Tier {
  /** 1-based rank of the tier (1 = lowest, 10 = highest) */
  rank: number
  /** Inclusive minimum balance required to reach this tier */
  threshold: number
  /** Display name */
  name: string
  /** Single-emoji icon for compact UI display */
  icon: string
  /** Primary accent color — used for the tier badge fill/border */
  color: string
  /** Translucent background variant of `color` for pill backgrounds */
  bg: string
  /** One-line aspirational description, shown on the Trust Economy page */
  description: string
}

export const TIERS: readonly Tier[] = [
  {
    rank: 1,
    threshold: 0,
    name: 'Newcomer',
    icon: '🌱',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    description: 'Welcome to FreeTrust. Set up your profile and say hello.',
  },
  {
    rank: 2,
    threshold: 100,
    name: 'Active Member',
    icon: '⭐',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.12)',
    description: 'You\'re getting involved — listing, posting, joining communities.',
  },
  {
    rank: 3,
    threshold: 250,
    name: 'Contributor',
    icon: '🌿',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.12)',
    description: 'You\'re contributing meaningfully to the community.',
  },
  {
    rank: 4,
    threshold: 500,
    name: 'Established Member',
    icon: '🤝',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.12)',
    description: 'Trusted by buyers and sellers. Your reputation is real.',
  },
  {
    rank: 5,
    threshold: 1000,
    name: 'FreeTrust Pro',
    icon: '💎',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.12)',
    description: 'A reliable operator. People know your name.',
  },
  {
    rank: 6,
    threshold: 2000,
    name: 'Community Leader',
    icon: '🏆',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.12)',
    description: 'You shape the community. Others look to you.',
  },
  {
    rank: 7,
    threshold: 5000,
    name: 'Trust Champion',
    icon: '🛡️',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    description: 'A pillar of trust. Top-tier reputation across categories.',
  },
  {
    rank: 8,
    threshold: 7500,
    name: 'Impact Leader',
    icon: '🌍',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.12)',
    description: 'Your contributions create lasting impact.',
  },
  {
    rank: 9,
    threshold: 10000,
    name: 'FreeTrust Elite',
    icon: '👑',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.14)',
    description: 'Elite status. Reserved for the most trusted few.',
  },
  {
    rank: 10,
    threshold: 25000,
    name: 'Founding Pillar',
    icon: '✨',
    color: '#facc15',
    bg: 'rgba(250,204,21,0.16)',
    description: 'The very top. A founding pillar of the Trust Economy.',
  },
] as const

export interface TierProgress {
  /** The user's current tier */
  current: Tier
  /** The next tier up, or null if the user is at the top */
  next: Tier | null
  /** ₮ needed to reach the next tier — 0 if at the top */
  toNext: number
  /** Progress from current threshold to next threshold, 0..1 */
  progress: number
}

/**
 * Resolve a balance to its tier and progress to the next tier.
 * Always returns a Tier (Newcomer at balance 0 or below).
 */
export function getTierForBalance(balance: number): TierProgress {
  const b = Number.isFinite(balance) && balance > 0 ? Math.floor(balance) : 0
  let current: Tier = TIERS[0]
  for (const t of TIERS) {
    if (b >= t.threshold) current = t
    else break
  }
  const next = TIERS.find(t => t.rank === current.rank + 1) ?? null
  if (!next) return { current, next: null, toNext: 0, progress: 1 }
  const span = next.threshold - current.threshold
  const gained = Math.max(0, b - current.threshold)
  const progress = span > 0 ? Math.min(gained / span, 1) : 0
  return {
    current,
    next,
    toNext: Math.max(0, next.threshold - b),
    progress,
  }
}
