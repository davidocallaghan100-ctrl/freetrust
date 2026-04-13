'use client'
import React from 'react'
import Link from 'next/link'
import { GRASSROOTS_GREEN } from '@/lib/grassroots/categories'

// ────────────────────────────────────────────────────────────────────────────
// CrossPromoBanner
// ────────────────────────────────────────────────────────────────────────────
// Subtle dark-navy card that cross-links the two marketplace surfaces
// (/services and /grassroots) so users who arrive on one can discover
// the other. Rendered directly below the hero on each browse page.
//
// Visual design intentionally subtle:
//   * Matches the dark navy #0f172a theme
//   * Narrow border-left accent in the TARGET section's brand colour
//     (cyan for services, earthy green for grassroots) so the user
//     immediately associates the banner with its destination
//   * Arrow CTA on the right
//   * Responsive — stacks vertically on narrow phones
//
// Usage:
//   <CrossPromoBanner target="grassroots" />   // rendered on /services
//   <CrossPromoBanner target="services"   />   // rendered on /grassroots

export type CrossPromoTarget = 'services' | 'grassroots'

interface Variant {
  href:     string
  eyebrow:  string
  title:    string
  body:     string
  cta:      string
  /** accent colour — border-left stripe + arrow + hover border */
  accent:   string
  /** faint tint for the left-side stripe glow */
  tint:     string
  emoji:    string
}

const VARIANTS: Record<CrossPromoTarget, Variant> = {
  // Shown ON /grassroots — promotes /services
  services: {
    href:    '/services',
    eyebrow: 'Need something more specialised?',
    title:   'Browse professional Services',
    body:    'Packaged work from vetted freelancers and agencies — design, dev, marketing, consulting, and more.',
    cta:     'Browse Services',
    accent:  '#38bdf8',            // sky-400 — matches the rest of the services UI
    tint:    'rgba(56,189,248,0.08)',
    emoji:   '🎯',
  },
  // Shown ON /services — promotes /grassroots
  grassroots: {
    href:    '/grassroots',
    eyebrow: 'Looking for local, casual help?',
    title:   'Browse Grassroots listings',
    body:    'Hands-on work in your community — farmers, drivers, tradespeople, and everyday helpers nearby.',
    cta:     'Browse Grassroots',
    accent:  GRASSROOTS_GREEN.primary,
    tint:    GRASSROOTS_GREEN.tint,
    emoji:   '🌱',
  },
}

export default function CrossPromoBanner({ target }: { target: CrossPromoTarget }) {
  const v = VARIANTS[target]
  return (
    <Link
      href={v.href}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: '#0f172a',
        border: '1px solid rgba(148,163,184,0.15)',
        borderLeft: `4px solid ${v.accent}`,
        borderRadius: 12,
        padding: '14px 18px',
        marginBottom: 16,
        transition: 'border-color 0.15s, transform 0.15s, background 0.15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderTopColor = v.accent + '55'
        e.currentTarget.style.borderRightColor = v.accent + '55'
        e.currentTarget.style.borderBottomColor = v.accent + '55'
        e.currentTarget.style.background = v.tint
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderTopColor = 'rgba(148,163,184,0.15)'
        e.currentTarget.style.borderRightColor = 'rgba(148,163,184,0.15)'
        e.currentTarget.style.borderBottomColor = 'rgba(148,163,184,0.15)'
        e.currentTarget.style.background = '#0f172a'
        e.currentTarget.style.transform = ''
      }}
    >
      <div
        className="cross-promo-row"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        {/* Emoji in a circular chip */}
        <div style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: v.tint,
          border: `1px solid ${v.accent}33`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}>
          {v.emoji}
        </div>

        {/* Copy */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: v.accent,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: 2,
          }}>
            {v.eyebrow}
          </div>
          <div style={{
            fontSize: 15,
            fontWeight: 800,
            color: '#f1f5f9',
            marginBottom: 2,
            lineHeight: 1.3,
          }}>
            {v.title}
          </div>
          <div style={{
            fontSize: 12,
            color: '#94a3b8',
            lineHeight: 1.5,
          }}>
            {v.body}
          </div>
        </div>

        {/* Arrow CTA */}
        <div style={{
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          border: `1px solid ${v.accent}55`,
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          color: v.accent,
          background: 'rgba(15,23,42,0.6)',
          whiteSpace: 'nowrap',
        }}>
          {v.cta} <span style={{ fontSize: 14 }}>→</span>
        </div>
      </div>
    </Link>
  )
}
