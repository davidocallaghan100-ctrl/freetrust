import { createClient } from '@supabase/supabase-js'
import { isCityLevel, resolveCoords } from '../lib/geo/city-lookup'
import { REAL_JOB_SOURCE_FILTER } from '../lib/dataIntegrity'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

async function main() {
  const { data, error } = await supabase
    .from('jobs')
    .select('id, title, location, city, country, latitude, longitude, is_remote, status, job_source')
    .in('status', ['active', 'open'])
    .or(REAL_JOB_SOURCE_FILTER)
    .or('latitude.is.null,longitude.is.null')

  if (error) throw error

  let updated = 0
  const skipped: Array<{ id: string; title: string | null; location: string | null; city: string | null; country: string | null }> = []

  for (const job of data ?? []) {
    if (job.is_remote === true) continue
    const coords = resolveCoords(job)
    // Backfill only exact/city-level results. Country centroids are used at
    // render time but not persisted, to avoid misleading precision.
    if (!isCityLevel(coords) || coords.confidence === 'exact') {
      skipped.push({
        id: job.id,
        title: job.title,
        location: job.location,
        city: job.city,
        country: job.country,
      })
      continue
    }

    const { error: updateError } = await supabase
      .from('jobs')
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq('id', job.id)

    if (updateError) throw updateError
    updated += 1
  }

  console.log(JSON.stringify({ updated, skipped }, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
