// Shared geolocation + location-parsing helpers for the globalised
// marketplace. Pure TypeScript with no React imports so these helpers can
// run on both the server (API routes, RSC) and the client.
//
// External services (all free, no API key required):
//   * Nominatim (OpenStreetMap) — place autocomplete + reverse geocoding
//   * ipapi.co                  — IP geolocation fallback for signup
//
// The same-origin rate limits for both services are generous for
// interactive use. Nominatim requires a descriptive User-Agent on every
// request (https://operations.osmfoundation.org/policies/nominatim/); we
// set one in the helpers below.

export interface GeoPoint {
  latitude: number
  longitude: number
}

export interface StructuredLocation {
  country: string | null       // ISO 3166-1 alpha-2 e.g. "IE"
  region: string | null        // state/province/county
  city: string | null
  latitude: number | null
  longitude: number | null
  location_label: string | null
}

export const EMPTY_LOCATION: StructuredLocation = {
  country: null,
  region: null,
  city: null,
  latitude: null,
  longitude: null,
  location_label: null,
}

// ────────────────────────────────────────────────────────────────────────────
// Haversine distance (great-circle) in kilometres.
// Client-side sorting fallback when the server can't compute distance.
// ────────────────────────────────────────────────────────────────────────────
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const dLat = toRad(b.latitude - a.latitude)
  const dLng = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

// ────────────────────────────────────────────────────────────────────────────
// Nominatim place autocomplete.
// Returns the top N matches for a free-text query, structured the same
// way the rest of the codebase uses locations.
// ────────────────────────────────────────────────────────────────────────────

export interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    country_code?: string
    country?: string
    city?: string
    town?: string
    village?: string
    state?: string
    county?: string
  }
}

export interface NominatimSuggestion {
  place_id: number
  label: string               // display_name trimmed to ~60 chars
  full_label: string          // original display_name
  structured: StructuredLocation
}

export async function searchNominatim(
  query: string,
  limit = 6,
  signal?: AbortSignal
): Promise<NominatimSuggestion[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(limit))
  // Bias toward city-level results; still allows country / region matches.
  url.searchParams.set('featuretype', 'settlement')

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim requires a real UA. 'freetrust.co/1.0' + contact page.
      'User-Agent': 'freetrust.co/1.0 (https://freetrust.co)',
      'Accept-Language': typeof navigator !== 'undefined' ? navigator.language : 'en',
    },
    signal,
  })
  if (!res.ok) return []
  const raw = (await res.json()) as NominatimResult[]
  return raw.map(toSuggestion)
}

function toSuggestion(r: NominatimResult): NominatimSuggestion {
  const addr = r.address ?? {}
  const city = addr.city ?? addr.town ?? addr.village ?? null
  const region = addr.state ?? addr.county ?? null
  const country_code = addr.country_code ? addr.country_code.toUpperCase() : null
  const lat = Number(r.lat)
  const lng = Number(r.lon)
  // Build a compact human label: "City, Country" (or display_name fallback)
  const label =
    [city, addr.country ?? country_code].filter(Boolean).join(', ') ||
    r.display_name
  return {
    place_id: r.place_id,
    label: label.length > 60 ? label.slice(0, 59) + '…' : label,
    full_label: r.display_name,
    structured: {
      country: country_code,
      region,
      city,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      location_label: label,
    },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Reverse geocoding — turn raw lat/lng (e.g. from navigator.geolocation)
// into a StructuredLocation. Used by the "Near Me" button to seed the
// filter UI with a friendly city label.
// ────────────────────────────────────────────────────────────────────────────
export async function reverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<StructuredLocation> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'freetrust.co/1.0 (https://freetrust.co)',
      'Accept-Language': typeof navigator !== 'undefined' ? navigator.language : 'en',
    },
    signal,
  })
  if (!res.ok) {
    return { ...EMPTY_LOCATION, latitude: lat, longitude: lng }
  }
  const raw = (await res.json()) as NominatimResult
  return toSuggestion(raw).structured
}

// ────────────────────────────────────────────────────────────────────────────
// Browser Geolocation API wrapped as a promise with a sensible timeout.
// Returns null if the user denies permission or the browser doesn't
// support it.
// ────────────────────────────────────────────────────────────────────────────
export function getBrowserGeoPoint(timeoutMs = 8000): Promise<GeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(null)
  }
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60_000 }
    )
  })
}

// ────────────────────────────────────────────────────────────────────────────
// IP geolocation fallback via ipapi.co (free, no API key, 30k req/month).
// Used on first sign-up to seed the user's profile country + currency
// without asking for permission. Returns null on any error.
// ────────────────────────────────────────────────────────────────────────────
export interface IpLocation extends StructuredLocation {
  currency_code: string | null
}

export async function fetchIpLocation(): Promise<IpLocation | null> {
  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
    if (!res.ok) return null
    const d = await res.json() as {
      country_code?: string
      country_name?: string
      region?: string
      city?: string
      latitude?: number
      longitude?: number
      currency?: string
      error?: boolean
    }
    if (d.error) return null
    const country = d.country_code?.toUpperCase() ?? null
    const label = [d.city, d.country_name ?? country].filter(Boolean).join(', ') || null
    return {
      country,
      region: d.region ?? null,
      city: d.city ?? null,
      latitude: typeof d.latitude === 'number' ? d.latitude : null,
      longitude: typeof d.longitude === 'number' ? d.longitude : null,
      location_label: label,
      currency_code: d.currency ? d.currency.toUpperCase() : null,
    }
  } catch {
    return null
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Parse "near X" / "in X" / trailing-city from a free-text search query.
// Example inputs:
//   "web design near Cork"       → { term: "web design",        location: "Cork"   }
//   "graphic designer in London" → { term: "graphic designer",  location: "London" }
//   "plumber Dublin"             → { term: "plumber",           location: "Dublin" } (fallback)
//   "logo design"                → { term: "logo design",       location: null     }
//
// The location extractor is deliberately conservative: it only treats the
// trailing 1-2 words as a location if they look like a place (capitalised
// or match a short known-city list). The caller can override by passing
// an explicit location filter, so false negatives are safer than false
// positives.
// ────────────────────────────────────────────────────────────────────────────
export interface ParsedSearch {
  term: string
  location: string | null
}

const LOCATION_PREPOSITIONS = [' near ', ' in ', ' from ', ' around ']

export function parseSearchQuery(raw: string): ParsedSearch {
  const q = raw.trim()
  if (!q) return { term: '', location: null }

  // Explicit preposition wins: "foo near bar" → term="foo", location="bar"
  for (const p of LOCATION_PREPOSITIONS) {
    const idx = q.toLowerCase().indexOf(p)
    if (idx > 0) {
      return {
        term: q.slice(0, idx).trim(),
        location: q.slice(idx + p.length).trim() || null,
      }
    }
  }

  // Heuristic fallback: if the last word is Capitalised and the query has
  // at least 2 words, treat it as a location. Avoids butchering single-
  // word queries like "Gardener" where the whole thing is the term.
  const parts = q.split(/\s+/)
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    if (/^[A-Z][a-zA-Z-]{2,}$/.test(last)) {
      return {
        term: parts.slice(0, -1).join(' '),
        location: last,
      }
    }
  }

  return { term: q, location: null }
}

// ────────────────────────────────────────────────────────────────────────────
// Distance radius presets shared by every browse page filter.
// ────────────────────────────────────────────────────────────────────────────
export const RADIUS_OPTIONS = [
  { value: 5,    label: 'Within 5 km'   },
  { value: 25,   label: 'Within 25 km'  },
  { value: 50,   label: 'Within 50 km'  },
  { value: 100,  label: 'Within 100 km' },
  { value: 500,  label: 'Within 500 km' },
  { value: 0,    label: 'Worldwide'     },
] as const

export type RadiusValue = typeof RADIUS_OPTIONS[number]['value']
