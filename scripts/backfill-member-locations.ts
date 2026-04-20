/**
 * backfill-member-locations.ts
 *
 * One-time script to backfill lat/lng for members who have no location data.
 * Since we don't store user IPs, we use a two-step approach:
 *
 * 1. For profiles with city + country → geocode via Nominatim
 * 2. For profiles with only country → use country centroid with jitter
 * 3. For profiles with nothing → infer from email domain TLD or skip
 *
 * Run with: npx tsx scripts/backfill-member-locations.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tioqakxnqjxyuzgnwhrb.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpb3Fha3hucWp4eXV6Z253aHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwNzc5OCwiZXhwIjoyMDkxMDgzNzk4fQ.gn5-rMINbSUKJEiNa733DIG8QK68jb7lUg0OPIz8efg'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Country centroids for fallback (ISO 3166-1 alpha-2)
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number; name: string }> = {
  IE: { lat: 53.1424, lng: -7.6921, name: 'Ireland' },
  GB: { lat: 51.5074, lng: -0.1278, name: 'United Kingdom' },
  US: { lat: 37.0902, lng: -95.7129, name: 'United States' },
  DE: { lat: 51.1657, lng: 10.4515, name: 'Germany' },
  FR: { lat: 46.2276, lng: 2.2137, name: 'France' },
  NL: { lat: 52.1326, lng: 5.2913, name: 'Netherlands' },
  BE: { lat: 50.5039, lng: 4.4699, name: 'Belgium' },
  ES: { lat: 40.4637, lng: -3.7492, name: 'Spain' },
  IT: { lat: 41.8719, lng: 12.5674, name: 'Italy' },
  MT: { lat: 35.9375, lng: 14.3754, name: 'Malta' },
  BG: { lat: 42.7339, lng: 25.4858, name: 'Bulgaria' },
  PL: { lat: 51.9194, lng: 19.1451, name: 'Poland' },
  PT: { lat: 39.3999, lng: -8.2245, name: 'Portugal' },
  AU: { lat: -25.2744, lng: 133.7751, name: 'Australia' },
  CA: { lat: 56.1304, lng: -106.3468, name: 'Canada' },
  IN: { lat: 20.5937, lng: 78.9629, name: 'India' },
  EE: { lat: 58.5953, lng: 25.0136, name: 'Estonia' },
  LV: { lat: 56.8796, lng: 24.6032, name: 'Latvia' },
  LT: { lat: 55.1694, lng: 23.8813, name: 'Lithuania' },
}

// Email TLD → country code mapping
const TLD_TO_COUNTRY: Record<string, string> = {
  'ie': 'IE',
  'co.ie': 'IE',
  'uk': 'GB',
  'co.uk': 'GB',
  'de': 'DE',
  'fr': 'FR',
  'nl': 'NL',
  'be': 'BE',
  'es': 'ES',
  'it': 'IT',
  'mt': 'MT',
  'bg': 'BG',
  'pl': 'PL',
  'pt': 'PT',
  'au': 'AU',
  'com.au': 'AU',
  'ca': 'CA',
  'in': 'IN',
  'ee': 'EE',
  'lv': 'LV',
  'lt': 'LT',
}

// Known domain → country mappings
const DOMAIN_TO_COUNTRY: Record<string, string> = {
  'umail.ucc.ie': 'IE',
  'bizzbeesolutions.com': 'BG', // BizzBee Solutions is a Bulgarian company
  'midas.mt': 'MT',
  'investmentcapitalgrowth.com': 'IE', // Irish-focused investment company
}

function jitter(value: number, amount = 0.15): number {
  return value + (Math.random() - 0.5) * amount * 2
}

function inferCountryFromEmail(email: string): string | null {
  const lower = email.toLowerCase()
  const domain = lower.split('@')[1]
  if (!domain) return null

  // Check known domain overrides first
  if (DOMAIN_TO_COUNTRY[domain]) return DOMAIN_TO_COUNTRY[domain]

  // Check TLD
  const parts = domain.split('.')
  // Try last two parts (e.g. co.uk, com.au)
  if (parts.length >= 3) {
    const twoPartTld = parts.slice(-2).join('.')
    if (TLD_TO_COUNTRY[twoPartTld]) return TLD_TO_COUNTRY[twoPartTld]
  }
  // Try last part (e.g. .ie, .de)
  const tld = parts[parts.length - 1]
  if (TLD_TO_COUNTRY[tld]) return TLD_TO_COUNTRY[tld]

  // Irish-sounding names heuristic (.com accounts) — very conservative
  // Only apply if email has clearly Irish names
  const irishPatterns = ['gaelic', 'odhran', 'padraig', 'ocallaghan', 'callaghan', 'byrne', 'kennelly', 'shanahan', 'donnellan', 'doyle', 'fegan', 'hannon', 'oneill']
  const emailLower = email.toLowerCase()
  if (irishPatterns.some(p => emailLower.includes(p))) return 'IE'

  return null
}

async function geocodeCity(city: string, country: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('city', city)
  url.searchParams.set('country', country)
  url.searchParams.set('format', 'json')
  url.searchParams.set('limit', '1')

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'freetrust.co/1.0 (https://freetrust.co)' },
    })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data[0]) return null
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  console.log('🗺️  FreeTrust Member Location Backfill')
  console.log('======================================')

  // Get all profiles without lat/lng
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, city, country, latitude, longitude')
    .is('latitude', null)
    .limit(100)

  if (error) {
    console.error('Failed to fetch profiles:', error.message)
    process.exit(1)
  }

  console.log(`Found ${profiles?.length ?? 0} profiles without location\n`)

  // Get auth users to map IDs → emails
  const { data: { users: authUsers } } = await supabase.auth.admin.listUsers()
  const emailById: Record<string, string> = {}
  for (const u of authUsers ?? []) {
    emailById[u.id] = u.email ?? ''
  }

  let geocoded = 0
  let countryFallback = 0
  let skipped = 0

  for (const profile of profiles ?? []) {
    const email = emailById[profile.id] ?? ''
    let lat: number | null = null
    let lng: number | null = null
    let city: string | null = profile.city ?? null
    let country: string | null = profile.country ?? null
    let location_label: string | null = null
    let method = ''

    // Strategy 1: Has city + country → geocode via Nominatim
    if (city && country) {
      const coords = await geocodeCity(city, country)
      if (coords) {
        lat = jitter(coords.lat)
        lng = jitter(coords.lng)
        location_label = `${city}, ${country}`
        method = 'nominatim'
        geocoded++
      }
      await sleep(1100) // Nominatim rate limit: 1 req/sec
    }

    // Strategy 2: Infer country from email domain → use country centroid
    if (lat === null) {
      const inferredCountry = inferCountryFromEmail(email)
      if (inferredCountry && COUNTRY_CENTROIDS[inferredCountry]) {
        const centroid = COUNTRY_CENTROIDS[inferredCountry]
        lat = jitter(centroid.lat, 0.3)
        lng = jitter(centroid.lng, 0.3)
        country = inferredCountry
        location_label = centroid.name
        method = `email-infer:${inferredCountry}`
        countryFallback++
      }
    }

    // Strategy 3: If profile has country code but no lat/lng
    if (lat === null && country && COUNTRY_CENTROIDS[country]) {
      const centroid = COUNTRY_CENTROIDS[country]
      lat = jitter(centroid.lat, 0.3)
      lng = jitter(centroid.lng, 0.3)
      location_label = centroid.name
      method = `country-centroid:${country}`
      countryFallback++
    }

    if (lat === null || lng === null) {
      console.log(`  ⏭️  SKIP  @${profile.username ?? email.split('@')[0]} — no location data available`)
      skipped++
      continue
    }

    // Update the profile
    const patch: Record<string, unknown> = { latitude: lat, longitude: lng }
    if (location_label) patch.location_label = location_label
    if (country && !profile.country) patch.country = country
    if (city && !profile.city) patch.city = city

    const { error: updateErr } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)

    if (updateErr) {
      console.log(`  ❌ ERROR @${profile.username ?? email} — ${updateErr.message}`)
    } else {
      console.log(`  ✅ SET   @${profile.username ?? email.split('@')[0]} → lat=${lat.toFixed(4)}, lng=${lng.toFixed(4)} [${method}]`)
    }
  }

  console.log('\n======================================')
  console.log(`✅ Geocoded via Nominatim:    ${geocoded}`)
  console.log(`🌍 Country centroid fallback: ${countryFallback}`)
  console.log(`⏭️  Skipped (no data):         ${skipped}`)
  console.log(`📍 Total updated:              ${geocoded + countryFallback}`)

  // Final count
  const { data: remaining } = await supabase
    .from('profiles')
    .select('id', { count: 'exact' })
    .is('latitude', null)
  console.log(`\n📊 Profiles still without lat/lng: ${remaining?.length ?? '?'}`)
}

main().catch(console.error)
