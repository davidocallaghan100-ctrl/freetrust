'use client'
import React from 'react'

// ────────────────────────────────────────────────────────────────────────────
// SocialLinks
// ────────────────────────────────────────────────────────────────────────────
// Renders clickable brand-coloured icons for every social URL a user has
// added to their profile. Used in three places:
//
//   1. Public profile page (`size="md"` — full row, all platforms)
//   2. Service + job listing cards (`size="sm"` + `max=3` — compact tray
//      under the seller name, prioritising LinkedIn → website → others)
//   3. Member directory cards (`size="sm"` + `max=4`)
//
// Brand icons are inline SVG so we don't depend on any external icon
// library or CDN — the project only has @heroicons/react which doesn't
// ship brand marks. lucide-react is mentioned in the spec but isn't
// actually installed; rather than adding a new dependency we ship the
// 7 icons we need here. They're trimmed simple-icons-style paths.
//
// Empty state: if the user has zero social links, the component renders
// `null` so callers don't need to gate the render themselves.

export interface SocialUrls {
  linkedin_url?:  string | null
  instagram_url?: string | null
  twitter_url?:   string | null
  github_url?:    string | null
  tiktok_url?:    string | null
  youtube_url?:   string | null
  website_url?:   string | null
}

type Platform =
  | 'linkedin'
  | 'instagram'
  | 'twitter'
  | 'github'
  | 'tiktok'
  | 'youtube'
  | 'website'

interface PlatformConfig {
  key:     Platform
  field:   keyof SocialUrls
  label:   string
  brand:   string         // brand colour
  Icon:    React.FC<{ size: number }>
}

// Inline SVG path data — extracted from simple-icons (CC0). Each component
// renders a single <path> at the chosen size, in `currentColor` so the
// caller can recolour via CSS / inline style.

const LinkedInIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
)

const InstagramIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.058-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
  </svg>
)

const TwitterIcon: React.FC<{ size: number }> = ({ size }) => (
  // X / Twitter — the modern X mark
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

const GitHubIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
  </svg>
)

const TikTokIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
  </svg>
)

const YouTubeIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
)

const GlobeIcon: React.FC<{ size: number }> = ({ size }) => (
  // Generic globe — used for "personal website" since there's no brand mark
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
  </svg>
)

// Platform configs ordered by visual priority — LinkedIn is shown first
// because it's the most professionally relevant for a trust-economy
// platform, then personal website, then the social platforms in
// audience-size order (Instagram → Twitter → GitHub → TikTok → YouTube).
//
// `compact` renderers slice this array so the prioritised platforms
// show first when there isn't room for all of them.
const PLATFORMS: PlatformConfig[] = [
  { key: 'linkedin',  field: 'linkedin_url',  label: 'LinkedIn',  brand: '#0a66c2', Icon: LinkedInIcon  },
  { key: 'website',   field: 'website_url',   label: 'Website',   brand: '#38bdf8', Icon: GlobeIcon     },
  { key: 'instagram', field: 'instagram_url', label: 'Instagram', brand: '#e1306c', Icon: InstagramIcon },
  { key: 'twitter',   field: 'twitter_url',   label: 'X (Twitter)', brand: '#ffffff', Icon: TwitterIcon },
  { key: 'github',    field: 'github_url',    label: 'GitHub',    brand: '#f1f5f9', Icon: GitHubIcon    },
  { key: 'tiktok',    field: 'tiktok_url',    label: 'TikTok',    brand: '#69c9d0', Icon: TikTokIcon    },
  { key: 'youtube',   field: 'youtube_url',   label: 'YouTube',   brand: '#ff0000', Icon: YouTubeIcon   },
]

export const SOCIAL_PLATFORMS = PLATFORMS

export type SocialLinksSize = 'sm' | 'md' | 'lg'

export interface SocialLinksProps {
  links: SocialUrls
  size?: SocialLinksSize
  /** Maximum number of icons to render (in priority order). Default: all */
  max?: number
  /** Render with a transparent background instead of the chip pill */
  flat?: boolean
  /** Stop click propagation — useful when SocialLinks lives inside a card Link */
  stopPropagation?: boolean
}

const SIZE_MAP: Record<SocialLinksSize, { icon: number; chip: number; gap: number }> = {
  sm: { icon: 13, chip: 26, gap: 6 },
  md: { icon: 16, chip: 32, gap: 8 },
  lg: { icon: 20, chip: 40, gap: 10 },
}

export default function SocialLinks({
  links,
  size = 'md',
  max,
  flat = false,
  stopPropagation = false,
}: SocialLinksProps) {
  const dims = SIZE_MAP[size]

  // Filter to only platforms with a non-empty URL, keeping the priority
  // order from PLATFORMS. Then optionally cap to `max`.
  const present = PLATFORMS
    .map(p => ({ p, url: (links[p.field] ?? '').trim() }))
    .filter(({ url }) => url.length > 0)

  const visible = typeof max === 'number' ? present.slice(0, max) : present

  if (visible.length === 0) return null

  return (
    <div
      className="ft-social-links"
      style={{ display: 'inline-flex', alignItems: 'center', gap: dims.gap, flexWrap: 'wrap' }}
    >
      {visible.map(({ p, url }) => (
        <a
          key={p.key}
          href={url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          aria-label={p.label}
          title={p.label}
          onClick={stopPropagation ? (e => e.stopPropagation()) : undefined}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: dims.chip,
            height: dims.chip,
            borderRadius: flat ? 0 : 8,
            background: flat ? 'transparent' : 'rgba(15,23,42,0.6)',
            border: flat ? 'none' : '1px solid rgba(148,163,184,0.18)',
            color: p.brand,
            textDecoration: 'none',
            transition: 'transform 0.12s, border-color 0.12s, background 0.12s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'
            if (!flat) {
              ;(e.currentTarget as HTMLElement).style.borderColor = p.brand + '60'
              ;(e.currentTarget as HTMLElement).style.background = p.brand + '14'
            }
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.transform = ''
            if (!flat) {
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.18)'
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(15,23,42,0.6)'
            }
          }}
        >
          <p.Icon size={dims.icon} />
        </a>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// URL helpers used by the settings form for cheap client-side validation.
// We deliberately don't enforce these at the API layer — better to accept
// a "weird-but-pasted-by-user" URL than to block a save with a regex
// argument. Server still trims whitespace via the allowlist normaliser.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Best-effort URL validator: accepts any string that parses as an
 * absolute http(s) URL OR a bare host like "linkedin.com/in/foo".
 * Returns true for empty input so optional fields don't show errors.
 */
export function isValidSocialUrl(raw: string): boolean {
  const v = raw.trim()
  if (!v) return true
  try {
    // If the user pasted a bare host like "github.com/foo" we prepend
    // https:// so the URL parser doesn't choke.
    const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`
    const u = new URL(withScheme)
    return u.hostname.includes('.')
  } catch {
    return false
  }
}

/**
 * Normalise on save: trim + prepend https:// if the user pasted a bare
 * host. Returns null for empty input so the DB stores NULL not an empty
 * string (cleaner for `.is.not.null` queries on the backend).
 */
export function normaliseSocialUrl(raw: string): string | null {
  const v = raw.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  return `https://${v}`
}
