// Grassroots category reference list
// ============================================================================
// Single source of truth for the 15 Grassroots categories used by:
//   * the browse page category grid + filter pills
//   * the create page step 2 category selector
//   * the card badge on every listing
//   * the profile page "Grassroots" section grouping
//
// Keep the slug column stable — it's written to the DB column
// `grassroots_listings.category` and any change would orphan existing rows.
// The label + emoji are presentation-only and can change freely.

export interface GrassrootsCategory {
  slug:  string
  label: string
  emoji: string
  /** Short one-line subtitle shown under the big category card on the
   *  browse page hero grid. Kept here so there's a single source of truth
   *  for category-level copy. */
  blurb: string
}

export const GRASSROOTS_CATEGORIES: readonly GrassrootsCategory[] = [
  { slug: 'farming',      label: 'Farming & Agriculture',  emoji: '🚜', blurb: 'Fieldwork, harvest, livestock' },
  { slug: 'delivery',     label: 'Delivery & Transport',   emoji: '🚚', blurb: 'Couriers, drivers, hauling' },
  { slug: 'trades',       label: 'Trades & Labour',        emoji: '🔧', blurb: 'Skilled hands-on work' },
  { slug: 'gardening',    label: 'Gardening & Landscaping',emoji: '🌿', blurb: 'Gardens, lawns, hedges' },
  { slug: 'cleaning',     label: 'Cleaning & Home Services', emoji: '🧹', blurb: 'Homes, offices, end-of-tenancy' },
  { slug: 'hospitality',  label: 'Hospitality & Catering', emoji: '🍺', blurb: 'Kitchen, bar, floor, events' },
  { slug: 'animal_care',  label: 'Animal Care',            emoji: '🐄', blurb: 'Livestock, pets, stables' },
  { slug: 'labour',       label: 'General Labour',         emoji: '🏗️', blurb: 'Sites, demolition, prep work' },
  { slug: 'childcare',    label: 'Childcare & Babysitting',emoji: '👶', blurb: 'Occasional or regular care' },
  { slug: 'elder_care',   label: 'Elder Care & Companionship', emoji: '🧓', blurb: 'Home visits, companionship' },
  { slug: 'fishing',      label: 'Fishing & Aquaculture',  emoji: '🎣', blurb: 'Boats, nets, hatcheries' },
  { slug: 'tutoring',     label: 'Local Tutoring & Teaching', emoji: '📚', blurb: 'In-person lessons, homework' },
  { slug: 'home_repairs', label: 'Home Repairs & Maintenance', emoji: '🔨', blurb: 'Fixes, odd jobs, touch-ups' },
  { slug: 'moving',       label: 'Moving & Heavy Lifting', emoji: '📦', blurb: 'House moves, furniture shifts' },
  { slug: 'events_help',       label: 'Events & Festival Help',   emoji: '🎪', blurb: 'Setup, stewards, teardown' },
  { slug: 'driving_instruction',  label: 'Driving Instruction',        emoji: '🚗', blurb: 'Lessons, test prep, refreshers' },
  { slug: 'sports_coaching',      label: 'Sports Coaching',             emoji: '⚽', blurb: 'GAA, football, swimming, youth coaching' },
  { slug: 'music_lessons',        label: 'Music Lessons',               emoji: '🎸', blurb: 'Guitar, piano, trad, voice, tin whistle' },
  { slug: 'car_valeting',         label: 'Car Valeting & Detailing',    emoji: '🚘', blurb: 'Mobile wash, polish, full valet' },
  { slug: 'mechanic_services',    label: 'Vehicle Repairs',             emoji: '🔩', blurb: 'NCT prep, mobile mechanic, tyres' },
  { slug: 'security_installation',label: 'Home Security & CCTV',        emoji: '🔒', blurb: 'Alarms, cameras, smart doorbells' },
  { slug: 'disability_support',   label: 'Disability & Home Support',   emoji: '♿', blurb: 'PA services, home help, carer relief' },
  { slug: 'photography_local',    label: 'Photography (Local)',          emoji: '📸', blurb: 'Communions, portraits, events, family' },
  { slug: 'language_support',     label: 'Translation & Language',      emoji: '🌍', blurb: 'Interpreting, documents, community' },
  { slug: 'beauty_mobile',        label: 'Mobile Beauty & Hair',        emoji: '💇', blurb: 'At-home cuts, nails, lashes' },
  { slug: 'it_support_local',     label: 'IT Help & Tech Support',      emoji: '🖥️', blurb: 'PC fixes, Wi-Fi, phone setup' },
  { slug: 'boat_water',           label: 'Boating & Water Services',    emoji: '⛵', blurb: 'Fishing trips, boat maintenance' },
] as const

/** O(1) lookup by slug. Built once at module load. */
export const GRASSROOTS_CATEGORIES_BY_SLUG: Readonly<Record<string, GrassrootsCategory>> =
  Object.freeze(Object.fromEntries(GRASSROOTS_CATEGORIES.map(c => [c.slug, c])))

/** Convenience: "{emoji} {label}" or the raw slug if unknown. */
export function grassrootsCategoryLabel(slug: string | null | undefined): string {
  if (!slug) return ''
  const c = GRASSROOTS_CATEGORIES_BY_SLUG[slug]
  return c ? `${c.emoji} ${c.label}` : slug
}

// ────────────────────────────────────────────────────────────────────────────
// Availability config — shared between cards + create form so the colour
// + label never drift between the two.
// ────────────────────────────────────────────────────────────────────────────

export type GrassrootsAvailability = 'immediate' | 'this_week' | 'this_month' | 'flexible'

export interface AvailabilityOption {
  value: GrassrootsAvailability
  label: string
  /** Foreground text colour for the badge */
  color: string
  /** Background tint for the badge (same hue, low alpha) */
  bg:    string
  /** Border colour for the badge */
  border: string
}

export const AVAILABILITY_OPTIONS: readonly AvailabilityOption[] = [
  { value: 'immediate',  label: 'Available now',    color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.35)'  },
  { value: 'this_week',  label: 'This week',        color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)' },
  { value: 'this_month', label: 'This month',       color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', border: 'rgba(56,189,248,0.35)' },
  { value: 'flexible',   label: 'Flexible',         color: '#94a3b8', bg: 'rgba(148,163,184,0.12)',border: 'rgba(148,163,184,0.3)' },
] as const

export const AVAILABILITY_BY_VALUE: Readonly<Record<string, AvailabilityOption>> =
  Object.freeze(Object.fromEntries(AVAILABILITY_OPTIONS.map(o => [o.value, o])))

// ────────────────────────────────────────────────────────────────────────────
// Rate type config
// ────────────────────────────────────────────────────────────────────────────

export type GrassrootsRateType = 'hourly' | 'daily' | 'fixed' | 'negotiable'

export const RATE_TYPE_OPTIONS: ReadonlyArray<{ value: GrassrootsRateType; label: string; suffix: string }> = [
  { value: 'hourly',     label: 'Per hour',      suffix: '/ hr'  },
  { value: 'daily',      label: 'Per day',       suffix: '/ day' },
  { value: 'fixed',      label: 'Fixed price',   suffix: ''       },
  { value: 'negotiable', label: 'Negotiable',    suffix: ''       },
] as const

// ────────────────────────────────────────────────────────────────────────────
// Contact preference config + per-preference deep link resolver.
// The browse card + detail page call buildContactHref() so the button
// opens the right app (WhatsApp / phone dialer / mail client / in-platform
// messages) based on what the worker picked.
// ────────────────────────────────────────────────────────────────────────────

export type ContactPreference = 'platform' | 'whatsapp' | 'phone' | 'email'

export const CONTACT_PREFERENCE_OPTIONS: ReadonlyArray<{
  value: ContactPreference
  label: string
  emoji: string
  /** Placeholder text for the contact_value input on the create form */
  placeholder: string
}> = [
  { value: 'platform', label: 'FreeTrust Messages', emoji: '💬', placeholder: '' },
  { value: 'whatsapp', label: 'WhatsApp',           emoji: '📱', placeholder: '+353 87 123 4567' },
  { value: 'phone',    label: 'Phone',              emoji: '📞', placeholder: '+353 87 123 4567' },
  { value: 'email',    label: 'Email',              emoji: '✉️', placeholder: 'you@example.com'  },
]

/**
 * Build the href the Contact button should navigate to, given the
 * listing's contact_preference + contact_value. Returns null for
 * platform preference (the caller should use next/link to /messages
 * manually, since the target user id is needed and that's not known
 * to this helper).
 *
 * Normalises phone numbers by stripping non-digit characters EXCEPT for
 * the leading +, which WhatsApp needs. Email URLs are url-encoded.
 */
export function buildContactHref(
  preference: ContactPreference | null | undefined,
  value: string | null | undefined
): string | null {
  if (!preference || !value) return null
  const v = value.trim()
  if (!v) return null
  switch (preference) {
    case 'whatsapp': {
      // wa.me wants digits only, with the leading country code and no +
      const digits = v.replace(/[^\d]/g, '')
      return digits ? `https://wa.me/${digits}` : null
    }
    case 'phone': {
      // tel: accepts + and digits
      const cleaned = v.replace(/[^\d+]/g, '')
      return cleaned ? `tel:${cleaned}` : null
    }
    case 'email': {
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? `mailto:${v}` : null
    }
    case 'platform':
    default:
      return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Branded colour palette — earthy green per the spec.
// Exported so the detail + create pages can reuse without drifting from
// the browse page tone.
// ────────────────────────────────────────────────────────────────────────────

export const GRASSROOTS_GREEN = {
  primary:    '#22c55e',   // green-500
  primaryDim: '#16a34a',   // green-600
  tint:       'rgba(34,197,94,0.12)',
  border:     'rgba(34,197,94,0.35)',
  borderSoft: 'rgba(34,197,94,0.2)',
} as const
