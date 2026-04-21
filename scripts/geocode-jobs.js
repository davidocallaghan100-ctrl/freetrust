const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.MAPBOX_TOKEN

if (!SUPABASE_URL || !SUPABASE_KEY || !MAPBOX_TOKEN) {
  console.error('Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_MAPBOX_TOKEN')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

const SKIP_PATTERNS = /worldwide|remote|anywhere|global|online|virtual/i

function extractQuery(location) {
  if (!location) return null
  if (SKIP_PATTERNS.test(location)) return null
  // If multiple comma-separated regions, take first token
  const parts = location.split(',').map(p => p.trim()).filter(Boolean)
  return parts[0] || null
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function geocode(query) {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}&limit=1`
  const res = await fetch(url)
  if (!res.ok) {
    console.error(`  Geocode HTTP error: ${res.status}`)
    return null
  }
  const data = await res.json()
  if (!data.features || data.features.length === 0) return null
  const f = data.features[0]
  const [lng, lat] = f.geometry.coordinates
  const ctx = f.properties?.context || {}
  const city = ctx.place?.name || ctx.locality?.name || ctx.district?.name || null
  const country = ctx.country?.name || null
  return { lat, lng, city, country }
}

async function main() {
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, location')
    .eq('status', 'active')
    .is('latitude', null)

  if (error) { console.error('Fetch error:', error); process.exit(1) }
  console.log(`Found ${jobs.length} active jobs with null coordinates\n`)

  let geocoded = 0
  let skipped = 0
  let failed = 0

  for (const job of jobs) {
    const query = extractQuery(job.location)
    if (!query) {
      console.log(`SKIP  "${job.title}" — location: "${job.location}"`)
      skipped++
      continue
    }

    const result = await geocode(query)
    if (!result) {
      console.log(`FAIL  "${job.title}" — location: "${job.location}" (query: "${query}") — no result`)
      failed++
    } else {
      const { error: updateErr } = await supabase
        .from('jobs')
        .update({
          latitude: result.lat,
          longitude: result.lng,
          ...(result.city ? { city: result.city } : {}),
          ...(result.country ? { country: result.country } : {}),
        })
        .eq('id', job.id)

      if (updateErr) {
        console.log(`ERROR "${job.title}" — update failed: ${updateErr.message}`)
        failed++
      } else {
        console.log(`OK    "${job.title}" — "${job.location}" → (${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}) ${result.city || ''} ${result.country || ''}`)
        geocoded++
      }
    }

    await sleep(200)
  }

  console.log(`\n=== Done: ${geocoded} geocoded, ${skipped} skipped, ${failed} failed ===`)
}

main().catch(err => { console.error(err); process.exit(1) })
