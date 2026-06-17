export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type BasketProductType = 'community' | 'external'

type BasketRow = {
  id: string
  product_type: BasketProductType
  quantity: number
  listing_id: string | null
  external_product_id: string | null
  created_at?: string | null
  added_at?: string | null
}

type ListingRow = {
  id: string
  title: string | null
  price: number | string | null
  price_eur: number | string | null
  currency: string | null
  currency_code: string | null
  images: string[] | null
  cover_image: string | null
  seller_id: string | null
}

type ExternalRow = {
  id: string
  title: string | null
  price: number | string | null
  price_eur: number | string | null
  currency: string | null
  thumbnail: string | null
  retailer_name: string | null
  retailer_url: string | null
}

function moneyLabel(price: unknown, priceEur: unknown, currency: unknown): { price_eur: number | null; price_label: string } {
  const eur = priceEur != null && Number.isFinite(Number(priceEur)) ? Number(priceEur) : null
  const raw = typeof price === 'number' ? price : typeof price === 'string' ? Number(String(price).replace(/[^0-9.-]/g, '')) : null
  const cur = typeof currency === 'string' && currency ? currency.toUpperCase() : 'EUR'
  const fallback = raw != null && Number.isFinite(raw) ? raw : eur
  const labelAmount = eur ?? fallback
  return {
    price_eur: eur ?? (cur === 'EUR' && fallback ? fallback : null),
    price_label: labelAmount ? new Intl.NumberFormat('en-IE', { style: 'currency', currency: cur === 'EUR' ? 'EUR' : cur }).format(labelAmount) : 'See price',
  }
}

async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

async function loadBasket(userId: string) {
  const admin = createAdminClient()
  const { data: rows, error } = await admin
    .from('basket_items')
    .select('id, product_type, quantity, listing_id, external_product_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw error

  const basketRows = (rows ?? []) as BasketRow[]
  const listingIds = basketRows.map(r => r.listing_id).filter(Boolean) as string[]
  const externalIds = basketRows.map(r => r.external_product_id).filter(Boolean) as string[]

  const [listingRes, externalRes] = await Promise.all([
    listingIds.length
      ? admin.from('listings').select('id, title, price, currency, currency_code, price_eur, images, cover_image, seller_id').in('id', listingIds)
      : Promise.resolve({ data: [] as ListingRow[], error: null }),
    externalIds.length
      ? admin.from('external_product_listings').select('id, title, price, price_eur, currency, thumbnail, retailer_name, retailer_url').in('id', externalIds)
      : Promise.resolve({ data: [] as ExternalRow[], error: null }),
  ])

  if (listingRes.error) throw listingRes.error
  if (externalRes.error) throw externalRes.error

  const listings = new Map(((listingRes.data ?? []) as ListingRow[]).map(row => [row.id, row]))
  const externals = new Map(((externalRes.data ?? []) as ExternalRow[]).map(row => [row.id, row]))

  return basketRows.map(row => {
    if (row.product_type === 'community') {
      const listing = row.listing_id ? listings.get(row.listing_id) : null
      const images = Array.isArray(listing?.images) ? listing.images : []
      const price = moneyLabel(listing?.price, listing?.price_eur, listing?.currency_code ?? listing?.currency)
      return {
        id: row.id,
        product_type: 'community' as const,
        quantity: Number(row.quantity ?? 1),
        listing_id: row.listing_id,
        external_product_id: null,
        title: String(listing?.title ?? 'Unavailable community product'),
        price_eur: price.price_eur,
        price_label: price.price_label,
        image: listing?.cover_image ?? images[0] ?? null,
        seller_id: listing?.seller_id ?? null,
      }
    }

    const external = row.external_product_id ? externals.get(row.external_product_id) : null
    const price = moneyLabel(external?.price, external?.price_eur, external?.currency)
    return {
      id: row.id,
      product_type: 'external' as const,
      quantity: Number(row.quantity ?? 1),
      listing_id: null,
      external_product_id: row.external_product_id,
      title: String(external?.title ?? 'Unavailable retailer product'),
      price_eur: price.price_eur,
      price_label: price.price_label,
      image: external?.thumbnail ?? null,
      retailer_name: external?.retailer_name ?? 'Retailer',
      retailer_url: external?.retailer_url ?? null,
    }
  })
}

export async function GET() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ userId: null, items: [] })

  try {
    return NextResponse.json({ userId: user.id, items: await loadBasket(user.id) })
  } catch (err) {
    console.error('[Basket API] load failed', err)
    return NextResponse.json({ error: 'Basket unavailable' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Please sign in to save items to your basket.' }, { status: 401 })

  let body: { product_type?: BasketProductType; listing_id?: string; external_product_id?: string; quantity?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const quantity = Math.max(1, Math.min(99, Number(body.quantity ?? 1)))
  const admin = createAdminClient()
  const match = body.product_type === 'community'
    ? { user_id: user.id, product_type: 'community', listing_id: body.listing_id }
    : { user_id: user.id, product_type: 'external', external_product_id: body.external_product_id }

  if (body.product_type === 'community' && !body.listing_id) return NextResponse.json({ error: 'Missing listing id' }, { status: 400 })
  if (body.product_type === 'external' && !body.external_product_id) return NextResponse.json({ error: 'Missing external product id' }, { status: 400 })
  if (body.product_type !== 'community' && body.product_type !== 'external') return NextResponse.json({ error: 'Invalid product type' }, { status: 400 })

  const { data: existing, error: existingError } = await admin.from('basket_items').select('id, quantity').match(match).maybeSingle()
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 })

  const write = existing?.id
    ? await admin.from('basket_items').update({ quantity: Math.min(99, Number(existing.quantity ?? 1) + quantity), updated_at: new Date().toISOString() }).eq('id', existing.id).eq('user_id', user.id)
    : await admin.from('basket_items').insert({ user_id: user.id, product_type: body.product_type, listing_id: body.listing_id ?? null, external_product_id: body.external_product_id ?? null, quantity })

  if (write.error) return NextResponse.json({ error: write.error.message }, { status: 500 })
  return NextResponse.json({ userId: user.id, items: await loadBasket(user.id) })
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { itemId?: string; quantity?: number } | null
  if (!body?.itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 })

  const quantity = Math.max(1, Math.min(99, Number(body.quantity ?? 1)))
  const { error } = await createAdminClient().from('basket_items').update({ quantity, updated_at: new Date().toISOString() }).eq('id', body.itemId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ userId: user.id, items: await loadBasket(user.id) })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const itemId = new URL(req.url).searchParams.get('itemId')
  if (!itemId) return NextResponse.json({ error: 'Missing item id' }, { status: 400 })

  const { error } = await createAdminClient().from('basket_items').delete().eq('id', itemId).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ userId: user.id, items: await loadBasket(user.id) })
}
