import { createClient } from '@supabase/supabase-js'
import { isCityLevel, resolveCoords } from '../lib/geo/city-lookup'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function main() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, location, location_label, city, country, latitude, longitude, show_on_map')
    .is('deleted_at', null)
    .or('latitude.is.null,longitude.is.null')

  if (error) throw error

  let updated = 0
  const skipped: Array<{ id: string; full_name: string | null; location: string | null; city: string | null; country: string | null }> = []

  for (const profile of data ?? []) {
    if (profile.show_on_map === false) continue
    const coords = resolveCoords(profile)
    // Backfill only exact/city-level results. Country centroids are OK for the
    // runtime map fallback, but we avoid permanently writing broad centroids.
    if (!isCityLevel(coords) || coords.confidence === 'exact') {
      skipped.push({
        id: profile.id,
        full_name: profile.full_name,
        location: profile.location,
        city: profile.city,
        country: profile.country,
      })
      continue
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq('id', profile.id)

    if (updateError) throw updateError
    updated += 1
  }

  console.log(JSON.stringify({ updated, skipped }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
