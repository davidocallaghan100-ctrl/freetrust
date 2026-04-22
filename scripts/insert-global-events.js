#!/usr/bin/env node
// Insert real verified global events into FreeTrust events table
// Run: node scripts/insert-global-events.js

// Manual env loading (dotenv not available as standalone dep)
const fs = require('fs')
const envFile = fs.readFileSync('.env.local', 'utf8')
envFile.split('\n').forEach(line => {
  const [k, ...v] = line.split('=')
  if (k && v.length) process.env[k.trim()] = v.join('=').trim()
})
const { createClient } = require('@supabase/supabase-js')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CREATOR_ID = '8d2bbd6a-9822-4ff0-a735-bff4d312be88'

const events = [
  // ── Ireland ─────────────────────────────────────────────────────────
  {
    title: 'Bloom Festival 2026',
    description: 'Ireland\'s largest gardening, food and family festival held in the stunning Phoenix Park, Dublin. Over 100 show gardens, 200+ exhibitors, celebrity chefs, and live entertainment across five days.',
    starts_at: '2026-05-28T09:00:00Z',
    ends_at:   '2026-06-01T20:00:00Z',
    venue_name: 'Phoenix Park',
    venue_address: 'Phoenix Park, Dublin 8, Ireland',
    city: 'Dublin', region: 'Leinster', country: 'IE',
    category: 'community', is_paid: true, ticket_price: 20, ticket_price_eur: 20, currency_code: 'EUR',
    is_online: false, external_id: 'curated-bloom-2026', external_source: 'curated',
    external_url: 'https://bloominthepark.com',
  },
  {
    title: 'Forbidden Fruit Festival 2026',
    description: 'Dublin\'s premier urban music and arts festival set in the stunning grounds of the Royal Hospital Kilmainham. Featuring top electronic, indie and alternative acts across multiple stages over the June bank holiday weekend.',
    starts_at: '2026-06-06T12:00:00Z',
    ends_at:   '2026-06-07T23:59:00Z',
    venue_name: 'Royal Hospital Kilmainham',
    venue_address: 'Military Rd, Kilmainham, Dublin 8, Ireland',
    city: 'Dublin', region: 'Leinster', country: 'IE',
    category: 'music', is_paid: true, ticket_price: 59, ticket_price_eur: 59, currency_code: 'EUR',
    is_online: false, external_id: 'curated-forbidden-fruit-2026', external_source: 'curated',
    external_url: 'https://forbiddenfruit.ie',
  },
  {
    title: 'Body & Soul Festival 2026',
    description: 'An intimate and magical arts, music and culture festival set on the beautiful grounds of Ballinlough Castle, Co. Westmeath. Known for its creative programming, wellbeing focus and unique atmosphere.',
    starts_at: '2026-06-19T12:00:00Z',
    ends_at:   '2026-06-21T23:00:00Z',
    venue_name: 'Ballinlough Castle',
    venue_address: 'Ballinlough Castle, Clonmellon, Co. Westmeath, Ireland',
    city: 'Clonmellon', region: 'Westmeath', country: 'IE',
    category: 'music', is_paid: true, ticket_price: 195, ticket_price_eur: 195, currency_code: 'EUR',
    is_online: false, external_id: 'curated-body-soul-2026', external_source: 'curated',
    external_url: 'https://bodyandsoul.ie',
  },
  {
    title: 'Taste of Dublin 2026',
    description: 'Ireland\'s premier outdoor food and drink festival returns to the beautiful Iveagh Gardens. Sample dishes from top Irish restaurants, meet celebrity chefs, attend cookery demonstrations and enjoy live entertainment.',
    starts_at: '2026-06-11T12:00:00Z',
    ends_at:   '2026-06-14T22:00:00Z',
    venue_name: 'Iveagh Gardens',
    venue_address: 'Clonmel St, Dublin 2, Ireland',
    city: 'Dublin', region: 'Leinster', country: 'IE',
    category: 'food', is_paid: true, ticket_price: 18, ticket_price_eur: 18, currency_code: 'EUR',
    is_online: false, external_id: 'curated-taste-dublin-2026', external_source: 'curated',
    external_url: 'https://tasteofdublin.ie',
  },
  {
    title: 'Galway International Arts Festival 2026',
    description: 'One of Europe\'s leading arts festivals, GIAF transforms Galway city every July with world-class theatre, visual art, music, comedy and street spectacle. A centrepiece of Ireland\'s cultural calendar.',
    starts_at: '2026-07-13T10:00:00Z',
    ends_at:   '2026-07-26T23:00:00Z',
    venue_name: 'Various Venues, Galway City',
    venue_address: 'Galway City, Ireland',
    city: 'Galway', region: 'Connacht', country: 'IE',
    category: 'arts', is_paid: false, ticket_price: 0, ticket_price_eur: 0, currency_code: 'EUR',
    is_online: false, external_id: 'curated-giaf-2026', external_source: 'curated',
    external_url: 'https://giaf.ie',
  },
  {
    title: 'Galway Races Summer Festival 2026',
    description: 'One of the world\'s most celebrated horse racing festivals, the Galway Races Summer Festival is a beloved Irish tradition combining top-class racing with fashion, entertainment and craic in Ballybrit Racecourse.',
    starts_at: '2026-07-27T12:00:00Z',
    ends_at:   '2026-08-02T18:00:00Z',
    venue_name: 'Galway Racecourse',
    venue_address: 'Ballybrit, Galway, Ireland',
    city: 'Galway', region: 'Connacht', country: 'IE',
    category: 'sports', is_paid: true, ticket_price: 25, ticket_price_eur: 25, currency_code: 'EUR',
    is_online: false, external_id: 'curated-galway-races-2026', external_source: 'curated',
    external_url: 'https://galwayraces.com',
  },
  {
    title: 'Kilkenny Arts Festival 2026',
    description: 'A celebration of visual art, classical music, literature, theatre and outdoor spectacle in the medieval city of Kilkenny. One of Ireland\'s longest-running and most respected arts festivals.',
    starts_at: '2026-08-08T10:00:00Z',
    ends_at:   '2026-08-16T23:00:00Z',
    venue_name: 'Various Venues, Kilkenny City',
    venue_address: 'Kilkenny City, Ireland',
    city: 'Kilkenny', region: 'Leinster', country: 'IE',
    category: 'arts', is_paid: false, ticket_price: 0, ticket_price_eur: 0, currency_code: 'EUR',
    is_online: false, external_id: 'curated-kilkenny-arts-2026', external_source: 'curated',
    external_url: 'https://kilkennyarts.ie',
  },
  {
    title: 'All-Ireland Senior Football Championship Final 2026',
    description: 'The pinnacle of Gaelic football — the All-Ireland Senior Football Championship Final at Croke Park, the home of the GAA. One of the most iconic occasions in Irish sport, drawing over 82,000 fans.',
    starts_at: '2026-08-02T15:30:00Z',
    ends_at:   '2026-08-02T17:30:00Z',
    venue_name: 'Croke Park',
    venue_address: 'Jones Road, Dublin 3, Ireland',
    city: 'Dublin', region: 'Leinster', country: 'IE',
    category: 'sports', is_paid: true, ticket_price: 50, ticket_price_eur: 50, currency_code: 'EUR',
    is_online: false, external_id: 'curated-allfootball-final-2026', external_source: 'curated',
    external_url: 'https://gaa.ie',
  },
  {
    title: 'All-Ireland Senior Hurling Championship Final 2026',
    description: 'The greatest day in hurling — the All-Ireland Senior Hurling Championship Final at Croke Park. Hurling is one of the world\'s oldest and fastest field sports, and the final draws the biggest crowd in Irish sport.',
    starts_at: '2026-07-19T15:30:00Z',
    ends_at:   '2026-07-19T17:30:00Z',
    venue_name: 'Croke Park',
    venue_address: 'Jones Road, Dublin 3, Ireland',
    city: 'Dublin', region: 'Leinster', country: 'IE',
    category: 'sports', is_paid: true, ticket_price: 50, ticket_price_eur: 50, currency_code: 'EUR',
    is_online: false, external_id: 'curated-allhurling-final-2026', external_source: 'curated',
    external_url: 'https://gaa.ie',
  },
  {
    title: 'Cork Jazz Festival 2026',
    description: 'The Guinness Cork Jazz Festival is one of Europe\'s top jazz events, attracting world-renowned jazz, blues and soul musicians to venues across Cork city over the October bank holiday weekend.',
    starts_at: '2026-10-23T18:00:00Z',
    ends_at:   '2026-10-26T23:59:00Z',
    venue_name: 'Various Venues, Cork City',
    venue_address: 'Cork City, Ireland',
    city: 'Cork', region: 'Munster', country: 'IE',
    category: 'music', is_paid: false, ticket_price: 0, ticket_price_eur: 0, currency_code: 'EUR',
    is_online: false, external_id: 'curated-cork-jazz-2026', external_source: 'curated',
    external_url: 'https://corkjazzfestival.com',
  },
  {
    title: 'Wexford Opera Festival 2026',
    description: 'The Wexford Festival Opera is one of the world\'s foremost opera festivals, presenting rare and neglected works to international acclaim. Held in the stunning National Opera House in Wexford town.',
    starts_at: '2026-10-22T19:00:00Z',
    ends_at:   '2026-11-01T23:00:00Z',
    venue_name: 'National Opera House',
    venue_address: 'High Street, Wexford, Ireland',
    city: 'Wexford', region: 'Leinster', country: 'IE',
    category: 'arts', is_paid: true, ticket_price: 45, ticket_price_eur: 45, currency_code: 'EUR',
    is_online: false, external_id: 'curated-wexford-opera-2026', external_source: 'curated',
    external_url: 'https://wexfordopera.com',
  },

  // ── Tech & Business (Global) ─────────────────────────────────────────
  {
    title: 'VivaTech 2026',
    description: 'Europe\'s biggest startup and tech event, bringing together 150,000 attendees from across the globe. Features the world\'s most innovative startups, major corporates, investors and world leaders in technology and business.',
    starts_at: '2026-06-11T09:00:00Z',
    ends_at:   '2026-06-13T18:00:00Z',
    venue_name: 'Paris Le Bourget',
    venue_address: 'Paris Le Bourget Exhibition Centre, Paris, France',
    city: 'Paris', region: 'Île-de-France', country: 'FR',
    category: 'tech', is_paid: true, ticket_price: 395, ticket_price_eur: 395, currency_code: 'EUR',
    is_online: false, external_id: 'curated-vivatech-2026', external_source: 'curated',
    external_url: 'https://vivatechnology.com',
  },
  {
    title: 'TNW Conference 2026',
    description: 'TNW Conference is Europe\'s leading tech festival, held in Amsterdam. Thousands of tech founders, investors and innovators gather to discuss the future of technology, startups and digital business.',
    starts_at: '2026-06-18T09:00:00Z',
    ends_at:   '2026-06-19T18:00:00Z',
    venue_name: 'NDSM Wharf',
    venue_address: 'NDSM-plein 1, Amsterdam, Netherlands',
    city: 'Amsterdam', region: 'North Holland', country: 'NL',
    category: 'tech', is_paid: true, ticket_price: 499, ticket_price_eur: 499, currency_code: 'EUR',
    is_online: false, external_id: 'curated-tnw-2026', external_source: 'curated',
    external_url: 'https://thenextweb.com/conference',
  },
  {
    title: 'Money20/20 Europe 2026',
    description: 'The world\'s most impactful fintech event. Money20/20 Europe brings together the global fintech ecosystem — banks, fintechs, payments companies and investors — to shape the future of money in Amsterdam.',
    starts_at: '2026-06-02T09:00:00Z',
    ends_at:   '2026-06-04T18:00:00Z',
    venue_name: 'RAI Amsterdam',
    venue_address: 'Europaplein 24, Amsterdam, Netherlands',
    city: 'Amsterdam', region: 'North Holland', country: 'NL',
    category: 'business', is_paid: true, ticket_price: 2499, ticket_price_eur: 2499, currency_code: 'EUR',
    is_online: false, external_id: 'curated-money2020eu-2026', external_source: 'curated',
    external_url: 'https://europe.money2020.com',
  },
  {
    title: 'Collision Conference 2026',
    description: 'North America\'s fastest-growing tech conference brings together 35,000 attendees from 140+ countries. Collision features startup pitches, investor meetings, and talks from the world\'s most influential tech leaders.',
    starts_at: '2026-06-23T09:00:00Z',
    ends_at:   '2026-06-25T18:00:00Z',
    venue_name: 'Enercare Centre',
    venue_address: '100 Princes\' Blvd, Toronto, ON M6K 3C3, Canada',
    city: 'Toronto', region: 'Ontario', country: 'CA',
    category: 'tech', is_paid: true, ticket_price: 999, ticket_price_eur: 920, currency_code: 'CAD',
    is_online: false, external_id: 'curated-collision-2026', external_source: 'curated',
    external_url: 'https://collisionconf.com',
  },
  {
    title: 'SaaStr Annual 2026',
    description: 'The world\'s largest gathering of SaaS founders, executives and investors. SaaStr Annual features 400+ sessions, 1,000+ speakers and unparalleled networking opportunities for B2B software entrepreneurs.',
    starts_at: '2026-09-08T09:00:00Z',
    ends_at:   '2026-09-10T18:00:00Z',
    venue_name: 'San Mateo County Event Center',
    venue_address: '1346 Saratoga Dr, San Mateo, CA 94403, USA',
    city: 'San Mateo', region: 'California', country: 'US',
    category: 'business', is_paid: true, ticket_price: 1299, ticket_price_eur: 1199, currency_code: 'USD',
    is_online: false, external_id: 'curated-saastr-2026', external_source: 'curated',
    external_url: 'https://saastrannual.com',
  },
  {
    title: 'Web Summit 2026',
    description: 'The world\'s largest technology conference, held in Lisbon. Web Summit brings together 70,000 attendees including startup founders, investors, Fortune 500 executives and world leaders to discuss the future of technology.',
    starts_at: '2026-11-02T09:00:00Z',
    ends_at:   '2026-11-05T18:00:00Z',
    venue_name: 'Altice Arena & FIL',
    venue_address: 'Rossio dos Olivais, Lisbon, Portugal',
    city: 'Lisbon', region: 'Lisboa', country: 'PT',
    category: 'tech', is_paid: true, ticket_price: 899, ticket_price_eur: 899, currency_code: 'EUR',
    is_online: false, external_id: 'curated-websummit-2026', external_source: 'curated',
    external_url: 'https://websummit.com',
  },
  {
    title: 'Slush 2026',
    description: 'The world\'s leading startup event, hosted in Helsinki. Slush brings together 13,000 attendees including the best founders, investors and media from around the globe for two days of deal-making and inspiration.',
    starts_at: '2026-11-17T09:00:00Z',
    ends_at:   '2026-11-18T22:00:00Z',
    venue_name: 'Messukeskus Helsinki',
    venue_address: 'Messuaukio 1, 00520 Helsinki, Finland',
    city: 'Helsinki', region: 'Uusimaa', country: 'FI',
    category: 'tech', is_paid: true, ticket_price: 695, ticket_price_eur: 695, currency_code: 'EUR',
    is_online: false, external_id: 'curated-slush-2026', external_source: 'curated',
    external_url: 'https://slush.org',
  },

  // ── Music (Global) ───────────────────────────────────────────────────
  {
    title: 'Glastonbury Festival 2026',
    description: 'The world\'s most famous music festival, held on Worthy Farm in Somerset, England. Glastonbury features over 3,000 acts across 100+ stages, covering every genre from headlining pop acts to jazz, folk, electronic and world music.',
    starts_at: '2026-06-24T08:00:00Z',
    ends_at:   '2026-06-28T23:59:00Z',
    venue_name: 'Worthy Farm',
    venue_address: 'Worthy Farm, Pilton, Shepton Mallet, Somerset BA4 4BY, UK',
    city: 'Pilton', region: 'Somerset', country: 'GB',
    category: 'music', is_paid: true, ticket_price: 375, ticket_price_eur: 445, currency_code: 'GBP',
    is_online: false, external_id: 'curated-glastonbury-2026', external_source: 'curated',
    external_url: 'https://glastonburyfestivals.co.uk',
  },
  {
    title: 'Primavera Sound Barcelona 2026',
    description: 'One of Europe\'s most acclaimed music festivals, held on the waterfront of Barcelona. Primavera Sound is celebrated for its eclectic and daring lineup spanning indie, electronic, hip-hop, pop and experimental music.',
    starts_at: '2026-05-28T16:00:00Z',
    ends_at:   '2026-06-01T04:00:00Z',
    venue_name: 'Parc del Fòrum',
    venue_address: 'Parc del Fòrum, Barcelona, Spain',
    city: 'Barcelona', region: 'Catalonia', country: 'ES',
    category: 'music', is_paid: true, ticket_price: 225, ticket_price_eur: 225, currency_code: 'EUR',
    is_online: false, external_id: 'curated-primavera-2026', external_source: 'curated',
    external_url: 'https://primaverasound.com',
  },
  {
    title: 'Roskilde Festival 2026',
    description: 'Scandinavia\'s biggest music and culture festival, and one of Europe\'s largest. Roskilde is a non-profit festival donating all surplus to humanitarian causes, featuring 175+ acts across 8 stages over 8 days.',
    starts_at: '2026-06-27T12:00:00Z',
    ends_at:   '2026-07-04T23:59:00Z',
    venue_name: 'Roskilde Festival Grounds',
    venue_address: 'Havsteensvej 11, 4000 Roskilde, Denmark',
    city: 'Roskilde', region: 'Zealand', country: 'DK',
    category: 'music', is_paid: true, ticket_price: 2895, ticket_price_eur: 388, currency_code: 'DKK',
    is_online: false, external_id: 'curated-roskilde-2026', external_source: 'curated',
    external_url: 'https://roskilde-festival.dk',
  },

  // ── Sports (Global) ──────────────────────────────────────────────────
  {
    title: 'UEFA Champions League Final 2026',
    description: 'The pinnacle of European club football — the UEFA Champions League Final. The 2026 final will be held at Estadio de San Mamés in Bilbao, Spain, bringing together the two best club teams in Europe.',
    starts_at: '2026-05-30T20:00:00Z',
    ends_at:   '2026-05-30T22:30:00Z',
    venue_name: 'Estadio de San Mamés',
    venue_address: 'Rafael Moreno Pitxitxi Kalea, 48013 Bilbao, Spain',
    city: 'Bilbao', region: 'Basque Country', country: 'ES',
    category: 'sports', is_paid: true, ticket_price: 70, ticket_price_eur: 70, currency_code: 'EUR',
    is_online: false, external_id: 'curated-ucl-final-2026', external_source: 'curated',
    external_url: 'https://uefa.com/uefachampionsleague',
  },
  {
    title: 'Ryder Cup 2026',
    description: 'The biennial golf competition between teams from Europe and the United States. The 2026 Ryder Cup is scheduled to be held at Adare Manor in Co. Limerick, Ireland — making it a landmark sporting event on Irish soil.',
    starts_at: '2026-09-25T08:00:00Z',
    ends_at:   '2026-09-27T18:00:00Z',
    venue_name: 'Adare Manor',
    venue_address: 'Adare, Co. Limerick, Ireland',
    city: 'Adare', region: 'Munster', country: 'IE',
    category: 'sports', is_paid: true, ticket_price: 120, ticket_price_eur: 120, currency_code: 'EUR',
    is_online: false, external_id: 'curated-ryder-cup-2026', external_source: 'curated',
    external_url: 'https://rydercup.com',
  },
]

async function main() {
  console.log(`Inserting ${events.length} real global events...`)

  // Check which external_ids already exist
  const externalIds = events.map(e => e.external_id)
  const { data: existing } = await admin
    .from('events')
    .select('external_id')
    .in('external_id', externalIds)

  const existingSet = new Set((existing ?? []).map(r => r.external_id))
  const toInsert = events.filter(e => !existingSet.has(e.external_id))

  if (toInsert.length === 0) {
    console.log('All events already exist — nothing to insert.')
    return
  }

  // Add common fields
  const rows = toInsert.map(e => ({
    ...e,
    creator_id: CREATOR_ID,
    is_platform_curated: true,
    attendee_count: 0,
    status: 'published',
    tags: [],
    timezone: 'UTC',
    latitude: null,
    longitude: null,
    location_label: e.city && e.country ? `${e.city}, ${e.country}` : null,
    meeting_url: null,
    organiser_name: null,
    organiser_bio: null,
    max_attendees: null,
  }))

  const { data, error } = await admin
    .from('events')
    .insert(rows)
    .select('id, title, starts_at')

  if (error) {
    console.error('Insert error:', error)
    process.exit(1)
  }

  console.log(`\n✅ Inserted ${data.length} events:`)
  data.forEach(e => console.log(`  - ${e.title} (${e.starts_at?.slice(0, 10)})`))
  console.log(`\nSkipped ${existingSet.size} already existing events.`)
}

main().catch(err => { console.error(err); process.exit(1) })
