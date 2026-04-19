'use client'
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

interface Props {
  /** ISO timestamp of when the org was verified — if provided, shown as a tooltip/subtitle */
  verifiedAt?: string | null
  /** Compact mode — renders a smaller inline pill */
  compact?: boolean
}

export default function VerifiedBadge({ verifiedAt, compact = false }: Props): JSX.Element {
  const since = verifiedAt
    ? new Date(verifiedAt).toLocaleDateString('en-IE', { month: 'short', year: 'numeric' })
    : null

  if (compact) {
    return (
      <span
        title={since ? `Verified organisation since ${since}` : 'Verified Organisation'}
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
      title={since ? `Verified since ${since}` : 'Verified Organisation'}
    >
      <CheckBadgeIcon style={{ width: 15, height: 15, color: '#10b981' }} />
      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Verified Organisation</span>
      {since && (
        <span style={{ fontSize: 10, color: '#6ee7b7', marginLeft: 2 }}>since {since}</span>
      )}
    </div>
  )
}
