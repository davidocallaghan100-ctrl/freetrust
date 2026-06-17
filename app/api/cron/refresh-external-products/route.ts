import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ARCHIVE_AFTER_DAYS, PRODUCT_CATEGORIES, PRODUCTS_PER_CATEGORY } from '@/lib/externalProductCategories'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SerpShoppingResult = {
  title?: string
  price?: string
  extracted_price?: number
  source?: string
  link?: string
  product_link?: string
  thumbnail?: string
  rating?: number
  reviews?: number
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  : null

function withReferralParams(link: string, categoryId: string) {
  try {
    const url = new URL(link)
    url.searchParams.set('utm_source', 'freetrust')
    url.searchParams.set('utm_medium', 'referral')
    url.searchParams.set('utm_campaign', 'external_catalogue')
    url.searchParams.set('utm_content', categoryId)
    return url.toString()
  } catch {
    return link
  }
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

  const results: Record<string, number> = {}
  const errors: string[] = []

  for (const category of PRODUCT_CATEGORIES) {
    try {
      const url = new URL('https://serpapi.com/search.json')
      url.searchParams.set('engine', 'google_shopping')
      url.searchParams.set('q', category.serpQuery)
      url.searchParams.set('gl', 'ie')
      url.searchParams.set('hl', 'en')
      url.searchParams.set('currency', 'EUR')
      url.searchParams.set('num', String(PRODUCTS_PER_CATEGORY))
      url.searchParams.set('api_key', process.env.SERPAPI_KEY)

      const res = await fetch(url.toString(), { cache: 'no-store' })
      const data = await res.json()

      if (!res.ok) {
        errors.push(`SerpApi error for ${category.id}: ${data?.error ?? res.statusText}`)
        continue
      }

      const products = ((data.shopping_results || []) as SerpShoppingResult[]).slice(0, PRODUCTS_PER_CATEGORY)
      if (products.length === 0) {
        errors.push(`No results for category: ${category.id}`)
        continue
      }

      const rows = products.map((item) => {
        const rawLink = item.link || item.product_link || ''
        return {
          title: item.title || 'Untitled Product',
          price: item.price || null,
          price_eur: typeof item.extracted_price === 'number' ? item.extracted_price : null,
          currency: 'EUR',
          retailer_name: item.source || 'Online Retailer',
          retailer_url: rawLink ? withReferralParams(rawLink, category.id) : '',
          thumbnail: item.thumbnail || null,
          rating: typeof item.rating === 'number' ? item.rating : null,
          review_count: typeof item.reviews === 'number' ? item.reviews : null,
          category: category.id,
          subcategory: category.subcategories?.[0] ?? null,
          is_trending: true,
          source: 'serpapi',
          last_refreshed_at: new Date().toISOString(),
        }
      }).filter(row => row.retailer_url !== '')

      const { error } = await supabase
        .from('external_product_listings')
        .upsert(rows, {
          onConflict: 'retailer_url',
          ignoreDuplicates: false,
        })

      if (error) {
        errors.push(`Supabase upsert error for ${category.id}: ${error.message}`)
      } else {
        results[category.id] = rows.length
      }

      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      errors.push(`Category ${category.id} failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const archiveDate = new Date()
  archiveDate.setDate(archiveDate.getDate() - ARCHIVE_AFTER_DAYS)

  // David's standing data-safety rule is no automatic deletion. Stale, never-clicked
  // retailer products are demoted from trending instead of being deleted.
  const { error: archiveError } = await supabase
    .from('external_product_listings')
    .update({ is_trending: false })
    .lt('last_refreshed_at', archiveDate.toISOString())
    .eq('click_count', 0)

  if (archiveError) {
    errors.push(`Archive error: ${archiveError.message}`)
  }

  return NextResponse.json({
    success: true,
    categoriesProcessed: Object.keys(results).length,
    productsUpserted: results,
    errors,
    timestamp: new Date().toISOString(),
  })
}
