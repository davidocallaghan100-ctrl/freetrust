#!/usr/bin/env node

/**
 * Import real OpenStreetMap venue rows for FreeTrust Experience Pubs and Activities.
 *
 * Data-integrity guardrails:
 * - imports only real OSM catalogue/venue rows with names and coordinates
 * - never creates pub_activities, community_activities, attendees, invites, comments, ratings, or social rows
 * - upserts OSM rows by durable OSM identity: data_source=openstreetmap + osm_type + osm_id
 * - does not delete or truncate existing data
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-osm-experience-ireland.mjs --apply
 *   node scripts/import-osm-experience-ireland.mjs --dry-run --max-chunks=2
 */

import { createClient } from '@supabase/supabase-js'

const APPLY = process.argv.includes('--apply')
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY
const CONTINUE_ON_ERROR = process.argv.includes('--continue-on-error')
const maxChunksArg = process.argv.find(arg => arg.startsWith('--max-chunks='))
const MAX_CHUNKS = maxChunksArg ? Number(maxChunksArg.split('=')[1]) : Infinity
const startChunkArg = process.argv.find(arg => arg.startsWith('--start-chunk='))
const START_CHUNK = startChunkArg ? Math.max(1, Number(startChunkArg.split('=')[1])) : 1
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (APPLY && (!supabaseUrl || !serviceRoleKey)) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = APPLY ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } }) : null

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const IRELAND_BOUNDS = {
  south: 51.2,
  west: -10.75,
  north: 55.45,
  east: -5.25,
}

function chunks() {
  const rows = []
  const latStep = 0.85
  const lonStep = 0.95
  for (let south = IRELAND_BOUNDS.south; south < IRELAND_BOUNDS.north; south += latStep) {
    for (let west = IRELAND_BOUNDS.west; west < IRELAND_BOUNDS.east; west += lonStep) {
      rows.push({
        south: Number(south.toFixed(4)),
        west: Number(west.toFixed(4)),
        north: Number(Math.min(south + latStep, IRELAND_BOUNDS.north).toFixed(4)),
        east: Number(Math.min(west + lonStep, IRELAND_BOUNDS.east).toFixed(4)),
      })
    }
  }
  return rows.slice(START_CHUNK - 1, START_CHUNK - 1 + MAX_CHUNKS)
}

function overpassQuery(kind, bbox) {
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  if (kind === 'pubs') {
    return `[out:json][timeout:90];(node["amenity"="pub"]["name"](${box});way["amenity"="pub"]["name"](${box});relation["amenity"="pub"]["name"](${box}););out center tags;`
  }
  return `[out:json][timeout:90];(
node["leisure"~"^(sports_centre|fitness_centre|stadium|track|swimming_pool|golf_course|park|pitch)$"]["name"](${box});
way["leisure"~"^(sports_centre|fitness_centre|stadium|track|swimming_pool|golf_course|park|pitch)$"]["name"](${box});
relation["leisure"~"^(sports_centre|fitness_centre|stadium|track|swimming_pool|golf_course|park|pitch)$"]["name"](${box});
node["amenity"~"^(community_centre|arts_centre)$"]["name"](${box});
way["amenity"~"^(community_centre|arts_centre)$"]["name"](${box});
relation["amenity"~"^(community_centre|arts_centre)$"]["name"](${box});
node["natural"="beach"]["name"](${box});
way["natural"="beach"]["name"](${box});
relation["natural"="beach"]["name"](${box});
);out center tags;`
}

async function fetchOverpass(query, label) {
  let lastError
  for (const endpoint of OVERPASS_ENDPOINTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
            'User-Agent': 'FreeTrust OSM venue import (real public OSM data; contact davidocallaghan100@gmail.com)',
          },
          body: new URLSearchParams({ data: query }),
        })
        if (!response.ok) throw new Error(`${endpoint} ${response.status}: ${await response.text()}`)
        return await response.json()
      } catch (error) {
        lastError = error
        console.warn(`[overpass] ${label} attempt ${attempt} failed on ${endpoint}: ${error.message}`)
        await wait(1200 * attempt)
      }
    }
  }
  throw lastError
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function elementLatLng(element) {
  const lat = element.lat ?? element.center?.lat
  const lng = element.lon ?? element.center?.lon
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return null
  return { lat: Number(lat), lng: Number(lng) }
}

function usefulActivityVenueName(name) {
  const compact = name.trim().replace(/[^\p{L}\p{N}]+/gu, '')
  const lower = name.toLowerCase()
  return compact.length >= 3 && /\p{L}/u.test(compact) && !/(^|\b)(disused|abandoned|derelict|proposed|construction)(\b|$)/i.test(lower)
}

function addressFrom(tags) {
  const parts = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  return parts || tags['addr:place'] || tags['addr:suburb'] || tags['addr:town'] || tags['addr:city'] || tags['addr:village'] || null
}

function cityFrom(tags) {
  return tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || tags['addr:suburb'] || tags['addr:county'] || null
}

function countryFrom(tags, latLng) {
  if (tags['addr:country']) return tags['addr:country']
  // Approximate split only for missing OSM address country. Northern Ireland sits mostly north/east of this rough line.
  if (latLng.lat > 54.0 && latLng.lng > -8.25) return 'GB-NIR'
  return 'IE'
}

function sourceUrl(element) {
  return `https://www.openstreetmap.org/${element.type}/${element.id}`
}

function openingHours(tags) {
  return tags.opening_hours ? { osm: tags.opening_hours } : null
}

function compactTags(tags, extra = {}) {
  const keep = {}
  for (const key of [
    'amenity', 'leisure', 'natural', 'sport', 'club', 'operator', 'tourism', 'fee', 'access', 'wheelchair',
    'outdoor_seating', 'website', 'contact:website', 'phone', 'contact:phone', 'opening_hours',
  ]) {
    if (tags[key]) keep[key] = tags[key]
  }
  return { ...extra, osm_tags: keep }
}

function pubRow(element) {
  const tags = element.tags ?? {}
  const latLng = elementLatLng(element)
  const name = tags.name?.trim()
  if (!name || !latLng) return null
  return {
    name,
    address: addressFrom(tags),
    city: cityFrom(tags),
    country: countryFrom(tags, latLng),
    lat: latLng.lat,
    lng: latLng.lng,
    phone: tags.phone || tags['contact:phone'] || null,
    website: tags.website || tags['contact:website'] || null,
    opening_hours: openingHours(tags),
    is_verified: false,
    avg_rating: null,
    data_source: 'openstreetmap',
    osm_type: element.type,
    osm_id: element.id,
    source_url: sourceUrl(element),
    source_updated_at: new Date().toISOString(),
    tags: compactTags(tags),
  }
}

function venueType(tags) {
  const leisure = tags.leisure
  const amenity = tags.amenity
  if (amenity === 'community_centre') return 'community_hall'
  if (amenity === 'arts_centre') return 'arts_centre'
  if (tags.natural === 'beach') return 'beach'
  if (leisure === 'fitness_centre') return 'gym'
  if (leisure === 'swimming_pool') return 'swimming_pool'
  if (leisure === 'golf_course') return 'golf_course'
  if (leisure === 'park') return 'park'
  if (leisure === 'stadium' || leisure === 'sports_centre' || leisure === 'pitch' || leisure === 'track') return 'sports_ground'
  return 'other'
}

function activityVenueRow(element) {
  const tags = element.tags ?? {}
  const latLng = elementLatLng(element)
  const name = tags.name?.trim()
  if (!name || !usefulActivityVenueName(name) || !latLng) return null
  return {
    name,
    address: addressFrom(tags),
    city: cityFrom(tags),
    country: countryFrom(tags, latLng),
    lat: latLng.lat,
    lng: latLng.lng,
    google_place_id: null,
    venue_type: venueType(tags),
    facilities: compactTags(tags, { sport: tags.sport || null }),
    is_verified: false,
    avg_rating: null,
    data_source: 'openstreetmap',
    osm_type: element.type,
    osm_id: element.id,
    source_url: sourceUrl(element),
    source_updated_at: new Date().toISOString(),
    tags: compactTags(tags, { sport: tags.sport || null }),
  }
}

function uniqueByOsm(rows) {
  const map = new Map()
  for (const row of rows) map.set(`${row.osm_type}:${row.osm_id}`, row)
  return [...map.values()]
}

async function collect(kind, mapper) {
  const all = []
  const boxes = chunks()
  for (let i = 0; i < boxes.length; i++) {
    const bbox = boxes[i]
    const label = `${kind} chunk ${i + 1}/${boxes.length} ${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
    console.log(`[fetch] ${label}`)
    const json = await fetchOverpass(overpassQuery(kind, bbox), label)
    const rows = (json.elements ?? []).map(mapper).filter(Boolean)
    console.log(`[fetch] ${label}: ${rows.length} named rows`)
    all.push(...rows)
    await wait(2500)
  }
  return uniqueByOsm(all)
}

async function collectChunk(kind, mapper, bbox, index, total) {
  const label = `${kind} chunk ${index + 1}/${total} ${bbox.south},${bbox.west},${bbox.north},${bbox.east}`
  console.log(`[fetch] ${label}`)
  const json = await fetchOverpass(overpassQuery(kind, bbox), label)
  const rows = uniqueByOsm((json.elements ?? []).map(mapper).filter(Boolean))
  console.log(`[fetch] ${label}: ${rows.length} named rows`)
  return rows
}

async function upsertInBatches(table, rows, columns = 'id') {
  if (!rows.length) return 0
  let written = 0
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500)
    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict: 'osm_type,osm_id', ignoreDuplicates: false })
      .select(columns)
    if (error) throw error
    written += batch.length
    console.log(`[write] ${table}: ${written}/${rows.length}`)
  }
  return written
}

async function applyIncrementally() {
  const boxes = chunks()
  const totals = { pubs: 0, activity_venues: 0, failed: [] }
  for (let i = 0; i < boxes.length; i++) {
    const bbox = boxes[i]
    for (const [kind, table, mapper] of [
      ['pubs', 'pubs', pubRow],
      ['activities', 'activity_venues', activityVenueRow],
    ]) {
      try {
        const rows = await collectChunk(kind, mapper, bbox, i, boxes.length)
        const written = await upsertInBatches(table, rows, 'id')
        totals[table] += written
      } catch (error) {
        const failed = `${kind} chunk ${START_CHUNK + i}`
        totals.failed.push({ chunk: failed, error: error.message })
        console.warn(`[skip] ${failed}: ${error.message}`)
        if (!CONTINUE_ON_ERROR) throw error
      }
      await wait(2500)
    }
  }
  console.log(JSON.stringify(totals, null, 2))
}

async function main() {
  console.log(`[mode] ${DRY_RUN ? 'dry-run' : 'apply'}; startChunk=${START_CHUNK}; chunks=${chunks().length}`)
  if (APPLY) {
    await applyIncrementally()
    return
  }
  const pubs = await collect('pubs', pubRow)
  const venues = await collect('activities', activityVenueRow)
  console.log(JSON.stringify({
    pubs: pubs.length,
    activity_venues: venues.length,
    pub_samples: pubs.slice(0, 5).map(row => ({ name: row.name, city: row.city, country: row.country, osm: `${row.osm_type}/${row.osm_id}` })),
    activity_samples: venues.slice(0, 5).map(row => ({ name: row.name, type: row.venue_type, city: row.city, country: row.country, osm: `${row.osm_type}/${row.osm_id}` })),
  }, null, 2))

  if (DRY_RUN) return

  await upsertInBatches('pubs', pubs, 'id')
  await upsertInBatches('activity_venues', venues, 'id')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
