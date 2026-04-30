export type CoordConfidence = 'exact' | 'city' | 'country'

export interface ResolvedCoords {
  lat: number
  lng: number
  confidence: CoordConfidence
  matched: string
}

export interface ResolveCoordInput {
  latitude?: number | string | null
  longitude?: number | string | null
  city?: string | null
  country?: string | null
  location?: string | null
  location_label?: string | null
  venue_name?: string | null
}

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  // Ireland
  dublin: { lat: 53.3498, lng: -6.2603 },
  cork: { lat: 51.8985, lng: -8.4756 },
  galway: { lat: 53.2707, lng: -9.0568 },
  limerick: { lat: 52.6638, lng: -8.6267 },
  waterford: { lat: 52.2593, lng: -7.1101 },
  kilkenny: { lat: 52.6541, lng: -7.2448 },
  wexford: { lat: 52.3342, lng: -6.4575 },
  sligo: { lat: 54.2766, lng: -8.4761 },
  drogheda: { lat: 53.7183, lng: -6.3484 },
  dundalk: { lat: 54.0042, lng: -6.4064 },
  athlone: { lat: 53.4239, lng: -7.9407 },
  tralee: { lat: 52.2675, lng: -9.7016 },
  ennis: { lat: 52.8458, lng: -8.9817 },
  killarney: { lat: 52.0592, lng: -9.5056 },
  bray: { lat: 53.2018, lng: -6.1110 },
  naas: { lat: 53.2197, lng: -6.6665 },
  navan: { lat: 53.6534, lng: -6.6798 },
  portlaoise: { lat: 53.0347, lng: -7.2993 },
  tullamore: { lat: 53.2742, lng: -7.4880 },
  mullingar: { lat: 53.5265, lng: -7.3381 },
  newry: { lat: 54.1751, lng: -6.3402 },

  // UK
  london: { lat: 51.5074, lng: -0.1278 },
  manchester: { lat: 53.4808, lng: -2.2426 },
  birmingham: { lat: 52.4862, lng: -1.8904 },
  glasgow: { lat: 55.8642, lng: -4.2518 },
  edinburgh: { lat: 55.9533, lng: -3.1883 },
  bristol: { lat: 51.4545, lng: -2.5879 },
  leeds: { lat: 53.8008, lng: -1.5491 },
  liverpool: { lat: 53.4084, lng: -2.9916 },
  belfast: { lat: 54.5973, lng: -5.9301 },

  // Europe
  paris: { lat: 48.8566, lng: 2.3522 },
  berlin: { lat: 52.5200, lng: 13.4050 },
  hamburg: { lat: 53.5511, lng: 9.9937 },
  cologne: { lat: 50.9375, lng: 6.9603 },
  koln: { lat: 50.9375, lng: 6.9603 },
  koeln: { lat: 50.9375, lng: 6.9603 },
  stuttgart: { lat: 48.7758, lng: 9.1829 },
  munich: { lat: 48.1351, lng: 11.5820 },
  munchen: { lat: 48.1351, lng: 11.5820 },
  frankfurt: { lat: 50.1109, lng: 8.6821 },
  karlsruhe: { lat: 49.0069, lng: 8.4037 },
  kassel: { lat: 51.3127, lng: 9.4797 },
  leipzig: { lat: 51.3397, lng: 12.3731 },
  essen: { lat: 51.4556, lng: 7.0116 },
  munster: { lat: 51.9607, lng: 7.6261 },
  muenster: { lat: 51.9607, lng: 7.6261 },
  jakobsdorf: { lat: 54.2373, lng: 12.9369 },
  'markt indersdorf': { lat: 48.3602, lng: 11.3778 },
  reichartshausen: { lat: 49.3567, lng: 8.9446 },
  'langweid am lech': { lat: 48.4893, lng: 10.8534 },
  poppenhausen: { lat: 50.4874, lng: 9.8678 },
  amsterdam: { lat: 52.3676, lng: 4.9041 },
  rotterdam: { lat: 51.9244, lng: 4.4777 },
  middelharnis: { lat: 51.7612, lng: 4.1680 },
  madrid: { lat: 40.4168, lng: -3.7038 },
  barcelona: { lat: 41.3851, lng: 2.1734 },
  rome: { lat: 41.9028, lng: 12.4964 },
  milan: { lat: 45.4654, lng: 9.1859 },
  lisbon: { lat: 38.7223, lng: -9.1393 },
  funchal: { lat: 32.6669, lng: -16.9241 },
  brussels: { lat: 50.8503, lng: 4.3517 },
  antwerp: { lat: 51.2194, lng: 4.4025 },
  vienna: { lat: 48.2082, lng: 16.3738 },
  stockholm: { lat: 59.3293, lng: 18.0686 },
  oslo: { lat: 59.9139, lng: 10.7522 },
  copenhagen: { lat: 55.6761, lng: 12.5683 },
  helsinki: { lat: 60.1699, lng: 24.9384 },
  zurich: { lat: 47.3769, lng: 8.5417 },
  geneva: { lat: 46.2044, lng: 6.1432 },
  warsaw: { lat: 52.2297, lng: 21.0122 },
  prague: { lat: 50.0755, lng: 14.4378 },
  budapest: { lat: 47.4979, lng: 19.0402 },
  bucharest: { lat: 44.4268, lng: 26.1025 },
  tallinn: { lat: 59.4370, lng: 24.7536 },
  torrevieja: { lat: 37.9847, lng: -0.6808 },
  limassol: { lat: 34.7071, lng: 33.0226 },
  malta: { lat: 35.9375, lng: 14.3754 },
  'beit shemesh': { lat: 31.7470, lng: 34.9881 },

  // Americas
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  chicago: { lat: 41.8781, lng: -87.6298 },
  toronto: { lat: 43.6532, lng: -79.3832 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  boston: { lat: 42.3601, lng: -71.0589 },
  seattle: { lat: 47.6062, lng: -122.3321 },
  miami: { lat: 25.7617, lng: -80.1918 },
  austin: { lat: 30.2672, lng: -97.7431 },
  vancouver: { lat: 49.2827, lng: -123.1207 },
  montreal: { lat: 45.5017, lng: -73.5673 },
  'mt. dora': { lat: 28.7739, lng: -81.6463 },
  'mt dora': { lat: 28.7739, lng: -81.6463 },
  'lady lake': { lat: 28.9175, lng: -81.9229 },
  asuncion: { lat: -25.2637, lng: -57.5759 },

  // Africa / Asia-Pacific
  lagos: { lat: 6.5244, lng: 3.3792 },
  abuja: { lat: 9.0765, lng: 7.3986 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  singapore: { lat: 1.3521, lng: 103.8198 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  tokyo: { lat: 35.6762, lng: 139.6503 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  mumbai: { lat: 19.0760, lng: 72.8777 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
}

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  ie: { lat: 53.4129, lng: -8.2439 }, ireland: { lat: 53.4129, lng: -8.2439 },
  gb: { lat: 55.3781, lng: -3.4360 }, uk: { lat: 55.3781, lng: -3.4360 }, 'united kingdom': { lat: 55.3781, lng: -3.4360 },
  us: { lat: 39.8283, lng: -98.5795 }, usa: { lat: 39.8283, lng: -98.5795 }, 'united states': { lat: 39.8283, lng: -98.5795 },
  nl: { lat: 52.1326, lng: 5.2913 }, netherlands: { lat: 52.1326, lng: 5.2913 }, 'the netherlands': { lat: 52.1326, lng: 5.2913 },
  nederland: { lat: 52.1326, lng: 5.2913 },
  pt: { lat: 39.3999, lng: -8.2245 }, portugal: { lat: 39.3999, lng: -8.2245 },
  de: { lat: 51.1657, lng: 10.4515 }, germany: { lat: 51.1657, lng: 10.4515 },
  fr: { lat: 46.2276, lng: 2.2137 }, france: { lat: 46.2276, lng: 2.2137 },
  es: { lat: 40.4637, lng: -3.7492 }, spain: { lat: 40.4637, lng: -3.7492 },
  be: { lat: 50.5039, lng: 4.4699 }, belgium: { lat: 50.5039, lng: 4.4699 },
  dk: { lat: 56.2639, lng: 9.5018 }, denmark: { lat: 56.2639, lng: 9.5018 },
  no: { lat: 60.4720, lng: 8.4689 }, norway: { lat: 60.4720, lng: 8.4689 },
  se: { lat: 60.1282, lng: 18.6435 }, sweden: { lat: 60.1282, lng: 18.6435 },
  fi: { lat: 61.9241, lng: 25.7482 }, finland: { lat: 61.9241, lng: 25.7482 },
  it: { lat: 41.8719, lng: 12.5674 }, italy: { lat: 41.8719, lng: 12.5674 },
  ch: { lat: 46.8182, lng: 8.2275 }, switzerland: { lat: 46.8182, lng: 8.2275 },
  at: { lat: 47.5162, lng: 14.5501 }, austria: { lat: 47.5162, lng: 14.5501 },
  pl: { lat: 51.9194, lng: 19.1451 }, poland: { lat: 51.9194, lng: 19.1451 },
  cz: { lat: 49.8175, lng: 15.4730 }, czechia: { lat: 49.8175, lng: 15.4730 }, 'czech republic': { lat: 49.8175, lng: 15.4730 },
  hu: { lat: 47.1625, lng: 19.5033 }, hungary: { lat: 47.1625, lng: 19.5033 },
  ro: { lat: 45.9432, lng: 24.9668 }, romania: { lat: 45.9432, lng: 24.9668 },
  ee: { lat: 58.5953, lng: 25.0136 }, estonia: { lat: 58.5953, lng: 25.0136 },
  bg: { lat: 42.7339, lng: 25.4858 }, bulgaria: { lat: 42.7339, lng: 25.4858 },
  mt: { lat: 35.9375, lng: 14.3754 }, cy: { lat: 35.1264, lng: 33.4299 }, cyprus: { lat: 35.1264, lng: 33.4299 },
  ng: { lat: 9.0820, lng: 8.6753 }, nigeria: { lat: 9.0820, lng: 8.6753 },
  il: { lat: 31.0461, lng: 34.8516 }, israel: { lat: 31.0461, lng: 34.8516 },
  py: { lat: -23.4425, lng: -58.4438 }, paraguay: { lat: -23.4425, lng: -58.4438 },
  br: { lat: -14.2350, lng: -51.9253 }, brazil: { lat: -14.2350, lng: -51.9253 },
  ca: { lat: 56.1304, lng: -106.3468 }, canada: { lat: 56.1304, lng: -106.3468 },
}

const VAGUE_OR_REMOTE = [
  'remote', 'worldwide', 'anywhere', 'global', 'usa timezones', 'european timezones',
  'americas', 'emea', 'latam', 'asia', 'oceania', 'timezones', 'multiple locations',
]

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.,&\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function asFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasVagueLocationOnly(value: string): boolean {
  const normalized = normalize(value)
  if (!normalized) return false
  const hasKnownCity = Object.keys(CITY_COORDS).some(city => normalized.includes(city))
  const hasKnownCountry = Object.keys(COUNTRY_COORDS).some(country => normalized === country || normalized.endsWith(` ${country}`) || normalized.includes(`, ${country}`))
  if (hasKnownCity || hasKnownCountry) return false
  return VAGUE_OR_REMOTE.some(term => normalized.includes(term))
}

function lookupText(value: string | null | undefined): ResolvedCoords | null {
  if (!value) return null
  const normalized = normalize(value)
  if (!normalized || hasVagueLocationOnly(value)) return null

  if (CITY_COORDS[normalized]) {
    return { ...CITY_COORDS[normalized], confidence: 'city', matched: normalized }
  }
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (normalized === city || normalized.startsWith(`${city},`) || normalized.endsWith(` ${city}`) || normalized.includes(`, ${city}`)) {
      return { ...coords, confidence: 'city', matched: city }
    }
  }

  if (COUNTRY_COORDS[normalized]) {
    return { ...COUNTRY_COORDS[normalized], confidence: 'country', matched: normalized }
  }
  for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
    if (normalized === country || normalized.startsWith(`${country},`) || normalized.endsWith(` ${country}`) || normalized.includes(`, ${country}`)) {
      return { ...coords, confidence: 'country', matched: country }
    }
  }

  return null
}

export function resolveCoords(input: ResolveCoordInput): ResolvedCoords | null {
  const lat = asFiniteNumber(input.latitude)
  const lng = asFiniteNumber(input.longitude)
  if (lat != null && lng != null) {
    return { lat, lng, confidence: 'exact', matched: 'stored coordinates' }
  }

  return (
    lookupText(input.city) ??
    lookupText(input.location_label) ??
    lookupText(input.location) ??
    lookupText(input.venue_name) ??
    lookupText(input.country) ??
    null
  )
}

export function isCityLevel(coords: ResolvedCoords | null): coords is ResolvedCoords {
  return coords != null && (coords.confidence === 'exact' || coords.confidence === 'city')
}
