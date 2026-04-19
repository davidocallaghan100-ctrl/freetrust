'use client'

// ─── ListingQualityBadge ──────────────────────────────────────────────────────
// Displays a quality tier badge (Featured / Top Rated / Highly Rated) derived
// from a listing's quality_score (0-100).
//
// Thresholds (mirror recalculate_listing_quality RPC):
//   ≥ 80  → Featured      (gold)
//   ≥ 60  → Top Rated     (green)
//   ≥ 40  → Highly Rated  (blue)
//   < 40  → null — render nothing
//
// Props:
//   qualityScore  – pre-fetched from listing.quality_score
//   avgRating     – listing.avg_rating (0-5)
//   reviewCount   – listing.review_count
//   compact       – if true, renders an inline pill only (no star row)
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  qualityScore: number | null | undefined
  avgRating?: number | null
  reviewCount?: number | null
  compact?: boolean
}

type Tier = 'featured' | 'top_rated' | 'highly_rated' | null

function getTier(score: number | null | undefined): Tier {
  if (score == null) return null
  if (score >= 80) return 'featured'
  if (score >= 60) return 'top_rated'
  if (score >= 40) return 'highly_rated'
  return null
}

const TIER_CONFIG: Record<NonNullable<Tier>, { label: string; emoji: string; color: string; bg: string; border: string }> = {
  featured: {
    label: 'Featured',
    emoji: '⭐',
    color: '#fbbf24',
    bg: 'rgba(251,191,36,0.10)',
    border: 'rgba(251,191,36,0.30)',
  },
  top_rated: {
    label: 'Top Rated',
    emoji: '🏆',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.10)',
    border: 'rgba(16,185,129,0.30)',
  },
  highly_rated: {
    label: 'Highly Rated',
    emoji: '✨',
    color: '#38bdf8',
    bg: 'rgba(56,189,248,0.10)',
    border: 'rgba(56,189,248,0.30)',
  },
}

function StarRow({ rating, reviewCount }: { rating: number; reviewCount: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {[1, 2, 3, 4, 5].map(i => (
          <span key={i} style={{ color: i <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: '0.8rem' }}>★</span>
        ))}
      </span>
      <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
        {rating.toFixed(1)}
      </span>
      <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
        ({reviewCount} review{reviewCount !== 1 ? 's' : ''})
      </span>
    </div>
  )
}

export default function ListingQualityBadge({ qualityScore, avgRating, reviewCount, compact = false }: Props) {
  const tier = getTier(qualityScore)
  if (!tier) return null

  const cfg = TIER_CONFIG[tier]
  const hasRating = avgRating != null && avgRating > 0
  const hasReviews = reviewCount != null && reviewCount > 0

  // ── Compact inline pill ────────────────────────────────────────────────────
  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: 12, padding: '2px 8px',
        fontSize: 11, color: cfg.color, fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {cfg.emoji} {cfg.label}
      </span>
    )
  }

  // ── Full card ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 12, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 16 }}>{cfg.emoji}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
        {qualityScore != null && (
          <span style={{ fontSize: 10, color: cfg.color, opacity: 0.7, marginLeft: 'auto' }}>
            {Math.round(qualityScore)}/100
          </span>
        )}
      </div>
      {hasRating && hasReviews && (
        <StarRow rating={avgRating!} reviewCount={reviewCount!} />
      )}
    </div>
  )
}
