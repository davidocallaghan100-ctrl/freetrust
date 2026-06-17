import { NextRequest, NextResponse } from 'next/server'

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

function withReferralParams(link: string) {
  try {
    const url = new URL(link)
    url.searchParams.set('utm_source', 'freetrust')
    url.searchParams.set('utm_medium', 'referral')
    url.searchParams.set('utm_campaign', 'find_online')
    return url.toString()
  } catch {
    return link
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim()
  if (!query) return NextResponse.json({ error: 'No query' }, { status: 400 })

  const apiKey = process.env.SERPAPI_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'SERPAPI_KEY is not configured' }, { status: 500 })
  }

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google_shopping')
  url.searchParams.set('q', query)
  url.searchParams.set('gl', 'ie')
  url.searchParams.set('hl', 'en')
  url.searchParams.set('currency', 'EUR')
  url.searchParams.set('api_key', apiKey)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json()

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.error ?? 'External search failed' },
      { status: res.status }
    )
  }

  const results = ((data.shopping_results || []) as SerpShoppingResult[]).slice(0, 8).map((item) => {
    const link = item.link || item.product_link || ''
    return {
      title: item.title ?? '',
      price: item.price ?? (typeof item.extracted_price === 'number' ? `€${item.extracted_price.toFixed(2)}` : ''),
      source: item.source ?? 'Retailer',
      link: link ? withReferralParams(link) : '',
      thumbnail: item.thumbnail ?? '',
      rating: item.rating ?? null,
      reviews: item.reviews ?? null,
    }
  }).filter(item => item.title && item.link)

  return NextResponse.json({ results })
}
