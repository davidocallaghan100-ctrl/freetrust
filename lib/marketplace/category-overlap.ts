// ────────────────────────────────────────────────────────────────────────────
// Cross-section category overlap map
// ────────────────────────────────────────────────────────────────────────────
// Several Services categories conceptually overlap with Grassroots
// categories — e.g. Services "Childcare & Education" and Grassroots
// "childcare" are the same kind of work at different professionalism
// levels. Without any signposting, users don't know that the category
// they're browsing has a cousin on the other side, and so they miss
// relevant listings.
//
// This file maps both directions:
//   * servicesToGrassroots(serviceId)  — given a Services category id,
//     return the Grassroots slug(s) that cover the same territory
//   * grassrootsToServices(grassrootsSlug) — the reverse
//
// The maps are hand-curated: the two taxonomies don't share slugs, and
// one Services category can map to multiple Grassroots slugs (e.g.
// "Home & Garden" overlaps with BOTH gardening AND home_repairs).
//
// The UI uses these maps to render a small "Also in Services" /
// "Also on Grassroots" badge next to any overlapping category pill,
// with a href to the other section's browse page with the matching
// filter pre-applied.
//
// When a Services category has multiple Grassroots matches, we link
// to /grassroots (no category filter) because a single cross-link
// can't pick between siblings — the user arrives on the grassroots
// index with the category grid to choose from.

/** One cross-link entry shown on a category pill. */
export interface CrossLink {
  /** href of the other-section browse page, optionally with a pre-filter */
  href:  string
  /** Short text rendered on the badge (e.g. "Also on Grassroots") */
  label: string
}

// ── Services id → Grassroots slug(s) ───────────────────────────────────────
// Keys are the Services category ids from lib/service-categories.ts.
// Values are ONE OR MORE matching Grassroots category slugs from
// lib/grassroots/categories.ts.
const SERVICES_TO_GRASSROOTS: Record<string, string[]> = {
  'trades-construction':  ['trades'],
  'home-garden':          ['gardening', 'home_repairs'],
  'food-catering':        ['hospitality'],
  'events-entertainment': ['events_help'],
  'transport-delivery':   ['delivery', 'moving'],
  'childcare-education':  ['childcare', 'tutoring'],
  'elder-care':           ['elder_care'],
  'pet-services':         ['animal_care'],
  'community-services':   ['labour'],
  // Taxi Drivers overlaps with grassroots 'delivery' (couriers,
  // drivers, hauling) — same territory at different professionalism
  // tiers. A user browsing the professional Taxi Drivers category
  // can click through to casual / informal driving work on
  // grassroots via the cross-link badge rendered by this map.
  'taxi-drivers':         ['delivery'],
  // Energy Services has no grassroots equivalent yet — solar / EV /
  // heat pump work is professional-only in the current taxonomy.
  // Intentionally NOT listed here so the badge renders nothing.
}

// ── Grassroots slug → Services id(s) ───────────────────────────────────────
// Derived from the reverse of SERVICES_TO_GRASSROOTS but maintained
// explicitly so future edits don't drift silently. Each grassroots slug
// maps to the closest professional-tier Services category.
const GRASSROOTS_TO_SERVICES: Record<string, string[]> = {
  trades:        ['trades-construction'],
  gardening:     ['home-garden'],
  home_repairs:  ['home-garden', 'trades-construction'],
  hospitality:   ['food-catering'],
  events_help:   ['events-entertainment'],
  // delivery overlaps with BOTH transport-delivery (couriers, moves)
  // and the new taxi-drivers category. Listing both lets the UI
  // show two cross-link badges on the grassroots delivery
  // category pill.
  delivery:      ['transport-delivery', 'taxi-drivers'],
  moving:        ['transport-delivery'],
  childcare:     ['childcare-education'],
  tutoring:      ['childcare-education'],
  elder_care:    ['elder-care'],
  animal_care:   ['pet-services'],
  labour:        ['community-services'],
  // No services equivalent — farming, fishing, cleaning, general labour
  // have no direct Services counterpart and return null from the lookup
  // so the UI skips the badge.
}

// ────────────────────────────────────────────────────────────────────────────
// Public helpers used by the browse pages
// ────────────────────────────────────────────────────────────────────────────

/**
 * Given a Services category id, return the CrossLink to show on that
 * category's pill, or null if there's no grassroots counterpart.
 */
export function servicesToGrassrootsLink(serviceId: string): CrossLink | null {
  const slugs = SERVICES_TO_GRASSROOTS[serviceId]
  if (!slugs || slugs.length === 0) return null
  // If there's exactly one matching grassroots category, deep-link into
  // it via the category query param. Otherwise link to the grassroots
  // index so the user picks.
  const href = slugs.length === 1
    ? `/grassroots?category=${encodeURIComponent(slugs[0])}`
    : '/grassroots'
  return { href, label: 'Also on Grassroots' }
}

/**
 * Given a Grassroots category slug, return the CrossLink to show on
 * that category's pill, or null if there's no services counterpart.
 */
export function grassrootsToServicesLink(grassrootsSlug: string): CrossLink | null {
  const ids = GRASSROOTS_TO_SERVICES[grassrootsSlug]
  if (!ids || ids.length === 0) return null
  // Single match → deep link. Multi → index.
  const href = ids.length === 1
    ? `/services?category=${encodeURIComponent(ids[0])}`
    : '/services'
  return { href, label: 'Also in Services' }
}

/** Full set of Services ids that have a Grassroots counterpart. */
export function servicesWithGrassrootsOverlap(): Set<string> {
  return new Set(Object.keys(SERVICES_TO_GRASSROOTS))
}

/** Full set of Grassroots slugs that have a Services counterpart. */
export function grassrootsWithServicesOverlap(): Set<string> {
  return new Set(Object.keys(GRASSROOTS_TO_SERVICES))
}
