import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  SERVICE_ARCHIVE_AFTER_DAYS,
  SERVICE_CATEGORIES,
  SERVICES_PER_CATEGORY,
} from '@/lib/externalServiceCategories'
import { fetchAwinServices } from '@/lib/awin'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SerpOrganicResult = {
  title?: string
  link?: string
  displayed_link?: string
  snippet?: string
  rating?: number
  reviews?: number
  thumbnail?: string
}

type SerpLocalResult = {
  title?: string
  website?: string
  link?: string
  rating?: number
  reviews?: number
  type?: string
  address?: string
  phone?: string
  thumbnail?: string
  gps_coordinates?: {
    latitude?: number
    longitude?: number
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null

function providerNameFromUrl(link: string, displayedLink?: string): string {
  if (displayedLink) return displayedLink.replace(/^https?:\/\//, '').replace(/^www\./, '')
  try {
    return new URL(link).hostname.replace(/^www\./, '')
  } catch {
    return 'External Provider'
  }
}

function providerFaviconUrl(link: string): string | null {
  try {
    const hostname = new URL(link).hostname.replace(/^www\./, '')
    if (!hostname) return null
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`
  } catch {
    return null
  }
}

function normaliseSerpRating(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function normaliseSerpReviews(value: unknown): number | null {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.round(numeric) : null
}

function normaliseProviderUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function dedupeRowsByProviderUrl<T extends { provider_url: string }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const deduped: T[] = []

  for (const row of rows) {
    const providerUrl = normaliseProviderUrl(row.provider_url)
    const key = providerUrl.toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    deduped.push({ ...row, provider_url: providerUrl })
  }

  return deduped
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabase) {
    return NextResponse.json({ error: 'Supabase service role is not configured' }, { status: 500 })
  }

  if (!process.env.SERPAPI_KEY) {
    return NextResponse.json({ error: 'SERPAPI_KEY is not configured' }, { status: 500 })
  }

  const results: Record<string, { serpapi: number; awin: number }> = {}
  const errors: string[] = []

  for (const category of SERVICE_CATEGORIES) {
    results[category.id] = { serpapi: 0, awin: 0 }

    try {
      if (category.serviceType !== 'local') {
        const serpUrl = new URL('https://serpapi.com/search.json')
        serpUrl.searchParams.set('engine', 'google')
        serpUrl.searchParams.set('q', category.serpQuery)
        serpUrl.searchParams.set('num', String(SERVICES_PER_CATEGORY))
        serpUrl.searchParams.set('hl', 'en')
        serpUrl.searchParams.set('api_key', process.env.SERPAPI_KEY)

        const serpRes = await fetch(serpUrl.toString(), { cache: 'no-store' })
        const serpData = await serpRes.json()

        if (!serpRes.ok) {
          errors.push(`SerpApi organic ${category.id}: ${serpData?.error ?? serpRes.statusText}`)
        } else {
          const organicResults = ((serpData.organic_results || []) as SerpOrganicResult[]).slice(0, SERVICES_PER_CATEGORY)
          const serpRows = dedupeRowsByProviderUrl(organicResults
            .filter(result => result.link && result.title)
            .map(result => ({
              title: result.title || 'Untitled Service',
              provider_name: providerNameFromUrl(result.link || '', result.displayed_link),
              provider_url: result.link || '',
              description: result.snippet || null,
              category: category.id,
              freetrust_category_id: category.freetrustCategoryId,
              service_type: category.serviceType === 'both' ? 'remote' : category.serviceType,
              price_display: null,
              rating: normaliseSerpRating(result.rating),
              review_count: normaliseSerpReviews(result.reviews),
              location: 'Remote / Worldwide',
              country: null,
              city: null,
              latitude: null,
              longitude: null,
              location_label: 'Remote / Worldwide',
              thumbnail: result.thumbnail || providerFaviconUrl(result.link || ''),
              image_source: result.thumbnail ? 'serpapi_google_organic' : 'favicon',
              source: 'serpapi',
              is_awin: false,
              awin_merchant_id: null,
              awin_deeplink: null,
              last_refreshed_at: new Date().toISOString(),
            }))
            .filter(row => row.provider_url))

          if (serpRows.length > 0) {
            const { error } = await supabase
              .from('external_service_listings')
              .upsert(serpRows, { onConflict: 'provider_url', ignoreDuplicates: false })

            if (error) errors.push(`SerpApi organic upsert ${category.id}: ${error.message}`)
            else results[category.id].serpapi += serpRows.length
          }
        }
      }

      if (category.serviceType !== 'remote') {
        const mapsUrl = new URL('https://serpapi.com/search.json')
        mapsUrl.searchParams.set('engine', 'google_maps')
        mapsUrl.searchParams.set('q', category.localSerpQuery || category.serpQuery)
        mapsUrl.searchParams.set('ll', '@51.8985,-8.4756,12z')
        mapsUrl.searchParams.set('hl', 'en')
        mapsUrl.searchParams.set('gl', 'ie')
        mapsUrl.searchParams.set('api_key', process.env.SERPAPI_KEY)

        const mapsRes = await fetch(mapsUrl.toString(), { cache: 'no-store' })
        const mapsData = await mapsRes.json()

        if (!mapsRes.ok) {
          errors.push(`SerpApi local ${category.id}: ${mapsData?.error ?? mapsRes.statusText}`)
        } else {
          const localResults = ((mapsData.local_results || []) as SerpLocalResult[]).slice(0, SERVICES_PER_CATEGORY)
          const localRows = dedupeRowsByProviderUrl(localResults
            .filter(result => result.title && (result.website || result.link))
            .map(result => {
              const providerUrl = result.website || result.link || ''
              const address = result.address || 'Cork, Ireland'
              const descriptionParts = [result.type, result.phone].filter(Boolean)
              return {
                title: result.title || 'Local Service Provider',
                provider_name: result.title || providerNameFromUrl(providerUrl),
                provider_url: providerUrl,
                description: descriptionParts.length > 0 ? descriptionParts.join(' · ') : null,
                category: category.id,
                freetrust_category_id: category.freetrustCategoryId,
                service_type: 'local',
                price_display: null,
                rating: normaliseSerpRating(result.rating),
                review_count: normaliseSerpReviews(result.reviews),
                location: address,
                country: 'IE',
                city: 'Cork',
                latitude: normaliseSerpRating(result.gps_coordinates?.latitude),
                longitude: normaliseSerpRating(result.gps_coordinates?.longitude),
                location_label: address,
                thumbnail: result.thumbnail || providerFaviconUrl(providerUrl),
                image_source: result.thumbnail ? 'serpapi_google_maps' : 'favicon',
                source: 'serpapi',
                is_awin: false,
                awin_merchant_id: null,
                awin_deeplink: null,
                last_refreshed_at: new Date().toISOString(),
              }
            })
            .filter(row => row.provider_url))

          if (localRows.length > 0) {
            const { error } = await supabase
              .from('external_service_listings')
              .upsert(localRows, { onConflict: 'provider_url', ignoreDuplicates: false })

            if (error) errors.push(`SerpApi local upsert ${category.id}: ${error.message}`)
            else results[category.id].serpapi += localRows.length
          }
        }
      }
    } catch (err) {
      errors.push(`SerpApi ${category.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }

    if (category.awinCategory) {
      try {
        const awinListings = await fetchAwinServices(category.awinCategory)
        const awinRows = dedupeRowsByProviderUrl(awinListings.map(item => ({
          ...item,
          category: category.id,
          freetrust_category_id: category.freetrustCategoryId,
          service_type: 'remote',
          price_display: null,
          rating: null,
          review_count: null,
          location: 'Remote / Worldwide',
          country: null,
          city: null,
          latitude: null,
          longitude: null,
          location_label: 'Remote / Worldwide',
          thumbnail: item.thumbnail || providerFaviconUrl(item.provider_url),
          image_source: item.thumbnail ? 'awin_logo' : 'favicon',
          last_refreshed_at: new Date().toISOString(),
        })))

        if (awinRows.length > 0) {
          const { error } = await supabase
            .from('external_service_listings')
            .upsert(awinRows, { onConflict: 'provider_url', ignoreDuplicates: false })

          if (error) errors.push(`Awin upsert ${category.id}: ${error.message}`)
          else results[category.id].awin = awinRows.length
        }
      } catch (err) {
        errors.push(`Awin ${category.id}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    await new Promise(resolve => setTimeout(resolve, 600))
  }

  const archiveDate = new Date()
  archiveDate.setDate(archiveDate.getDate() - SERVICE_ARCHIVE_AFTER_DAYS)

  // David's FreeTrust data-safety rule forbids automatic row deletion without
  // explicit approval. We report stale never-engaged rows instead of deleting
  // them; a future additive migration can add an `is_active` flag if needed.
  const { count: staleNeverEngagedCount, error: staleCountError } = await supabase
    .from('external_service_listings')
    .select('id', { count: 'exact', head: true })
    .lt('last_refreshed_at', archiveDate.toISOString())
    .eq('click_count', 0)
    .eq('lead_count', 0)

  if (staleCountError) errors.push(`Stale service count: ${staleCountError.message}`)

  return NextResponse.json({
    success: true,
    categoriesProcessed: SERVICE_CATEGORIES.length,
    results,
    staleNeverEngagedCount: staleNeverEngagedCount ?? 0,
    errors,
    timestamp: new Date().toISOString(),
  })
}
