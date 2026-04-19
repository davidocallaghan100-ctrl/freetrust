#!/usr/bin/env npx ts-node --project tsconfig.json
/**
 * scripts/backfill-quality-scores.ts
 *
 * Backfills quality_score and featured_at for all active listings that already
 * have at least one review by calling recalculate_listing_quality() for each.
 *
 * Run from repo root:
 *   npx ts-node -e "$(cat scripts/backfill-quality-scores.ts)"
 * or:
 *   npx tsx scripts/backfill-quality-scores.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('Fetching listings with review_count > 0…')

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id, title, avg_rating, review_count, quality_score')
    .gt('review_count', 0)
    .order('review_count', { ascending: false })

  if (error) {
    console.error('Failed to fetch listings:', error.message)
    process.exit(1)
  }

  console.log(`Found ${listings?.length ?? 0} listings to backfill.`)
  if (!listings || listings.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let ok = 0
  let failed = 0

  for (const listing of listings) {
    const { error: rpcError } = await supabase.rpc('recalculate_listing_quality', {
      p_listing_id: listing.id,
    })
    if (rpcError) {
      console.error(`  ✗ ${listing.title} (${listing.id}): ${rpcError.message}`)
      failed++
    } else {
      console.log(`  ✓ ${listing.title} — rating=${listing.avg_rating}, reviews=${listing.review_count}`)
      ok++
    }
  }

  console.log(`\nDone. ${ok} updated, ${failed} failed.`)
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
