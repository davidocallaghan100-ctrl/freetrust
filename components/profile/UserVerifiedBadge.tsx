'use client'
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

// Visual twin of components/organisation/VerifiedBadge.tsx but for
// individual user accounts. Uses the same green palette (#10b981)
// so any "verified" surface across the platform reads consistently.
// Text differs deliberately — "Verified Member" rather than
// "Verified Organisation" — so members and orgs are visually
// distinguishable from the badge text alone.

interface Props {
  /** ISO timestamp of when the user was verified — if provided, shown as a tooltip/subtitle */
  verifiedAt?: string | null
  /** Compact mode — renders a smaller inline pill */
  compact?: boolean
}

export default function UserVerifiedBadge({ verifiedAt, compact = false }: Props): JSX.Element {
  const since = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })
    : null

  if (compact) {
    return (
      <span
        title={since ? `Verified member since ${since}` : 'Verified Member'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 8px',
          borderRadius: 20,
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.25)',
          fontSize: 11,
          fontWeight: 700,
          color: '#10b981',
          whiteSpace: 'nowrap',
        }}
      >
        <CheckBadgeIcon style={{ width: 13, height: 13 }} />
        Verified
      </span>
    )
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 12px',
        borderRadius: 20,
        background: 'rgba(16,185,129,0.1)',
        border: '1px solid rgba(16,185,129,0.2)',
      }}
      title={since ? `Verified since ${since}` : 'Verified Member'}
    >
      <CheckBadgeIcon style={{ width: 15, height: 15, color: '#10b981' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Verified Member</span>
      {since && (
        <span style={{ fontSize: 10, color: '#6ee7b7', marginLeft: 2 }}>since {since}</span>
      )}
    </div>
  )
}
