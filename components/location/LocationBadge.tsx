'use client'
import React from 'react'

// Small tag shown on every listing card to reinforce global discovery.
// Shows location_label (e.g. "London, UK") or "Remote / Online" when
// is_remote=true. When neither is set, renders nothing — we don't want
// an empty "📍 unknown" clogging the UI.
//
// Usage:
//   <LocationBadge label="London, UK" />
//   <LocationBadge label={null} remote />
//   <LocationBadge label="Berlin, Germany" distanceKm={12.4} />

export interface LocationBadgeProps {
  label: string | null | undefined
  remote?: boolean
  distanceKm?: number | null
  compact?: boolean
}

export default function LocationBadge({
  label,
  remote = false,
  distanceKm = null,
  compact = false,
}: LocationBadgeProps) {
  // Remote takes precedence — a remote listing is defined by its absence
  // of a physical location even if the creator typed one in.
  if (remote) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: compact ? '2px 6px' : '3px 8px',
        background: 'rgba(52,211,153,0.1)',
        border: '1px solid rgba(52,211,153,0.25)',
        borderRadius: 6,
        fontSize: compact ? 10 : 11,
        fontWeight: 600,
        color: '#34d399',
        whiteSpace: 'nowrap',
      }}>
        🌐 Remote / Online
      </span>
    )
  }

  if (!label) return null

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: compact ? '2px 6px' : '3px 8px',
      background: 'rgba(56,189,248,0.08)',
      border: '1px solid rgba(56,189,248,0.2)',
      borderRadius: 6,
      fontSize: compact ? 10 : 11,
      fontWeight: 600,
      color: '#38bdf8',
      maxWidth: 220,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      📍 {label}
      {typeof distanceKm === 'number' && (
        <span style={{ color: '#64748b', fontWeight: 500, marginLeft: 2 }}>
          · {distanceKm < 1 ? '<1' : Math.round(distanceKm)} km
        </span>
      )}
    </span>
  )
}
