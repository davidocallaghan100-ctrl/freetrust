'use client'
import React from 'react'
import Link from 'next/link'
import type { CrossLink } from '@/lib/marketplace/category-overlap'

// ────────────────────────────────────────────────────────────────────────────
// CategoryOverlapBadge
// ────────────────────────────────────────────────────────────────────────────
// Small clickable pill rendered next to a category card/pill when that
// category exists on both /services AND /grassroots. Shows text like
// "Also on Grassroots →" or "Also in Services →".
//
// Accepts the CrossLink shape from lib/marketplace/category-overlap
// so callers don't have to know about href construction. Renders null
// when the link is null (no overlap) so the caller can just pass the
// lookup result directly without gating the render.
//
// stopPropagation on click is critical: this badge is usually rendered
// inside a parent category button that has its own onClick/filter-set
// handler, and we don't want clicking the cross-link to ALSO toggle the
// parent category filter on the current page.

interface Props {
  link: CrossLink | null
  /** "grassroots" (green) or "services" (cyan) — controls accent colour */
  flavor: 'grassroots' | 'services'
}

export default function CategoryOverlapBadge({ link, flavor }: Props) {
  if (!link) return null

  const accent = flavor === 'grassroots' ? '#22c55e' : '#38bdf8'

  return (
    <Link
      href={link.href}
      onClick={e => e.stopPropagation()}
      title={link.label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        background: 'rgba(15,23,42,0.6)',
        border: `1px solid ${accent}44`,
        borderRadius: 999,
        fontSize: 9,
        fontWeight: 700,
        color: accent,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
        letterSpacing: '0.02em',
        // Overflow-safe on small screens — the label is short enough that
        // this should never actually truncate, but be defensive.
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {link.label} →
    </Link>
  )
}
