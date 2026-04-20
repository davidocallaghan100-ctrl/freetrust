/**
 * clear-estimated-locations.ts
 *
 * Removes backfill-estimated (country centroid + jitter) locations from profiles.
 * Only profiles with real GPS-captured locations are kept.
 *
 * Real locations identified by:
 * - Precise city-level coordinates (not matching any country centroid ±0.5°)
 * - location_label contains a specific city name (not just a country name)
 *
 * Run with: npx tsx scripts/clear-estimated-locations.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tioqakxnqjxyuzgnwhrb.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpb3Fha3hucWp4eXV6Z253aHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwNzc5OCwiZXhwIjoyMDkxMDgzNzk4fQ.gn5-rMINbSUKJEiNa733DIG8QK68jb7lUg0OPIz8efg'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// IDs of profiles with REAL GPS locations — DO NOT clear these
const REAL_LOCATION_IDS = new Set([
  'be8ddadb-a1b2-4e04-a8a9-75e2a5eaaea1', // Wexford, Ireland — precise GPS
  '59ce075d-3f30-4db9-892d-85a8f4576b61', // Mt. Dora, US — precise GPS
  '1ddd770a-c088-4eab-a3dd-2303557a794d', // Middelharnis, Netherlands — precise city
  '8d2bbd6a-9822-4ff0-a735-bff4d312be88', // @Davos212 Cork, Ireland — precise GPS
])

async function main() {
  console.log('Fetching all profiles with lat/lng...')

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, username, latitude, longitude, location_label, country')
    .not('latitude', 'is', null)

  if (error) {
    console.error('Error fetching profiles:', error)
    process.exit(1)
  }

  console.log(`Found ${profiles?.length ?? 0} profiles with lat/lng`)

  const toClear = (profiles ?? []).filter(p => !REAL_LOCATION_IDS.has(p.id))

  console.log(`\nProfiles to KEEP (real GPS): ${REAL_LOCATION_IDS.size}`)
  console.log(`Profiles to CLEAR (estimated): ${toClear.length}`)
  console.log('\nClearing estimated locations...')

  let cleared = 0
  for (const p of toClear) {
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        latitude: null,
        longitude: null,
        location_label: null,
        // Keep city/country as they may have been real data (just no precise coords)
      })
      .eq('id', p.id)

    if (updateErr) {
      console.error(`  ❌ ERROR @${p.username ?? p.id}: ${updateErr.message}`)
    } else {
      console.log(`  ✅ CLEARED @${p.username ?? 'anon'} (was: ${p.location_label ?? `${p.latitude},${p.longitude}`})`)
      cleared++
    }
  }

  console.log(`\n✅ Done. Cleared ${cleared} estimated locations.`)

  // Verify
  const { data: remaining } = await supabase
    .from('profiles')
    .select('id, username, latitude, location_label')
    .not('latitude', 'is', null)

  console.log(`\nProfiles still with lat/lng: ${remaining?.length ?? 0}`)
  for (const p of remaining ?? []) {
    console.log(`  ✅ @${p.username ?? 'anon'}: ${p.location_label} (${p.latitude})`)
  }
}

main().catch(console.error)
