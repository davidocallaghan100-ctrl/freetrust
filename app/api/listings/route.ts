export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toPgUrlArray, toPgTagArray } from '@/lib/supabase/text-array'
import { awardTrust } from '@/lib/trust/award'
import { applyApiRateLimit } from '@/lib/security/api-helpers'
import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'

// GET /api/listings — list active listings (public) or all own listings (authenticated)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const offset = (page - 1) * limit
    const category = searchParams.get('category')
    const categoryId = searchParams.get('category_id')
    const serviceMode = searchParams.get('mode') // online | offline | both
    const location = searchParams.get('location')
    const search = searchParams.get('q')
    const mine = searchParams.get('mine') === 'true'

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('listings')
      .select('*, profiles!seller_id(id, full_name, avatar_url)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (mine && user) {
      query = query.eq('seller_id', user.id)
    } else {
      query = query.eq('status', 'active')
    }

    if (category) query = query.eq('category', category)
    if (categoryId) query = query.eq('category_id', categoryId)
    if (serviceMode) query = query.eq('service_mode', serviceMode)
    if (location) query = query.ilike('location', `%${location}%`)
    if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)

    const { data: listings, error, count } = await query

    if (error) {
      console.error('[GET /api/listings]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      listings: listings ?? [],
      total: count ?? 0,
      page,
      limit,
    })
  } catch (err) {
    console.error('[GET /api/listings] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/listings — create a new listing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit — 100 req/min per user. Listings creation is low
    // frequency but caps a runaway client loop or spam attack.
    const rateLimitResponse = applyApiRateLimit(request, user.id)
    if (rateLimitResponse) return rateLimitResponse

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
      console.error('[POST /api/listings] body parse failed:', msg)
      return NextResponse.json(
        { error: `Request body is not valid JSON: ${msg}` },
        { status: 400 }
      )
    }
    console.log('[listings POST] incoming body:', JSON.stringify(body))

    // Validate required fields. `cover_image` + `stock_qty` were previously
    // missing from this destructure — the client sends them but they were
    // silently dropped, leading to products that showed no cover image and
    // always rendered "out of stock" on the detail page.
    const {
      title,
      description,
      price,
      currency = 'EUR',
      product_type,
      category_id,
      category,
      service_mode = 'online',
      location,
      service_radius,
      delivery_types = [],
      tags = [],
      images = [],
      cover_image = null,
      stock_qty = null,
    } = body as Record<string, unknown>

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }
    if (typeof price !== 'number' || price < 0) {
      return NextResponse.json({ error: 'Price must be a non-negative number' }, { status: 400 })
    }

    // Ensure product_type is always set so services and products are kept separate
    const resolvedProductType = (typeof product_type === 'string' && product_type.trim())
      ? product_type.trim()
      : 'physical'

    // Encode every text[] column as a PostgreSQL array literal string
    // BEFORE the insert. PostgREST's JSON → text[] coercion fails on
    // some Supabase project versions with "The string did not match the
    // expected pattern" (see lib/supabase/text-array.ts for the full
    // history). Images are additionally filtered to http(s) URLs only
    // so a bad client can't poison the column with garbage.
    const imagesLiteral        = toPgUrlArray(images)
    const tagsLiteral          = toPgTagArray(tags)
    const deliveryTypesLiteral = toPgTagArray(delivery_types)

    // Normalise cover_image: accept an https URL or null; anything else
    // falls back to the first uploaded image or null so we never write
    // garbage into the column.
    const coverImageResolved = (typeof cover_image === 'string' && /^https?:\/\//i.test(cover_image))
      ? cover_image
      : (Array.isArray(images) && typeof images[0] === 'string' && /^https?:\/\//i.test(images[0]))
        ? images[0]
        : null

    // Normalise stock_qty: accept a non-negative integer or null. Reject
    // negative / non-integer / non-number values quietly (fall back to null).
    const stockResolved = (typeof stock_qty === 'number' && Number.isFinite(stock_qty) && stock_qty >= 0)
      ? Math.floor(stock_qty)
      : null

    const insertPayload = {
      seller_id: user.id,
      title: (title as string).trim(),
      description: (description as string).trim(),
      price,
      currency,
      product_type: resolvedProductType,
      category_id: (category_id as string | null) ?? null,
      category: (category as string | null) ?? null,
      service_mode: service_mode,
      location: (location as string | null) ?? null,
      service_radius: (service_radius as number | null) ?? null,
      delivery_types: deliveryTypesLiteral,
      tags: tagsLiteral,
      images: imagesLiteral,
      cover_image: coverImageResolved,
      stock_qty: stockResolved,
      status: 'active',
    }
    console.log('[listings POST] insertPayload:', JSON.stringify(insertPayload))

    let listing
    try {
      const { data, error } = await supabase
        .from('listings')
        .insert(insertPayload)
        .select()
        .single()

      // Always log the insert result BEFORE any branch so we can see it
      // in Vercel logs regardless of which path we take next. This is
      // the main diagnostic for the "blank response" class of failure.
      console.log('[listings POST] insert result:', { data, error })

      if (error) {
        console.error('[POST /api/listings] insert error:', error)
        // Surface the PostgREST "expected pattern" case with a more
        // actionable message. Falls through to the generic branch for
        // any other error (duplicate key, RLS denial, NOT NULL, etc).
        if (typeof error.message === 'string' && error.message.toLowerCase().includes('expected pattern')) {
          return NextResponse.json(
            {
              error:
                'Listing insert failed: PostgREST rejected the text[] cast ' +
                '— tags/images/delivery_types may contain invalid characters. ' +
                'Try removing emoji or non-ASCII characters from your input.',
              detail: error.message,
            },
            { status: 500 }
          )
        }
        return NextResponse.json(
          { error: error.message || 'Listing insert failed with no error message', detail: error },
          { status: 500 }
        )
      }

      // Defensive: if supabase returns { data: null, error: null } (edge
      // case — e.g. RLS allows INSERT but blocks SELECT on the returning
      // row), we'd previously respond with `{ listing: null }` which the
      // client translated to "Product created but server did not return
      // a listing id" — a misleading, impossible-to-diagnose error.
      if (!data) {
        console.error('[POST /api/listings] insert succeeded but .single() returned null')
        return NextResponse.json(
          {
            error:
              'Listing insert returned no row — this usually means the SELECT ' +
              'RLS policy blocks reading the row you just inserted. Check the ' +
              '"Active listings are viewable by everyone" policy on the listings table.',
          },
          { status: 500 }
        )
      }
      listing = data
    } catch (insertErr) {
      // Catches any exception the supabase-js client throws outside the
      // returned { error } channel — including the DOMException-style
      // "The string did not match the expected pattern" that some
      // versions emit before the request even leaves the client.
      const msg = insertErr instanceof Error ? insertErr.message : String(insertErr)
      console.error('[POST /api/listings] insert threw:', msg)
      if (msg.toLowerCase().includes('expected pattern')) {
        return NextResponse.json(
          {
            error:
              'Listing insert failed: the Supabase client rejected the payload ' +
              'during serialisation. This is usually a bad image URL or an ' +
              'unexpected character in tags. Try again with plain-text tags ' +
              'and https:// image URLs only.',
            detail: msg,
          },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: `Listing insert failed: ${msg}` }, { status: 500 })
    }

    console.log('[listings POST] success, returning listing id:', (listing as { id?: string })?.id)

    // Award ₮ for creating the listing. Non-blocking — if the
    // award fails, the listing is still created and the user
    // still sees success. Same bug-class as Cliff's missing-coins
    // issue on /api/create/publish — this route ALSO had no trust
    // award before the audit commit.
    //
    // Uses CREATE_SERVICE for service listings (product_type='service')
    // and CREATE_PRODUCT otherwise, so the reward matches the type
    // of listing the user created.
    const listingRow = listing as { id?: string; product_type?: string; title?: string } | null
    const isService = listingRow?.product_type === 'service'
    const trustResult = await awardTrust({
      userId: user.id,
      amount: isService ? TRUST_REWARDS.CREATE_SERVICE : TRUST_REWARDS.CREATE_PRODUCT,
      type:   isService ? TRUST_LEDGER_TYPES.CREATE_SERVICE : TRUST_LEDGER_TYPES.CREATE_PRODUCT,
      ref:    listingRow?.id ?? null,
      desc:   isService
        ? `Published service: ${listingRow?.title ?? 'Untitled'}`
        : `Listed product: ${listingRow?.title ?? 'Untitled'}`,
    })

    return NextResponse.json({
      listing,
      trustAwarded: trustResult.ok ? trustResult.amount : 0,
    }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/listings] Unexpected error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { error: `Internal server error: ${msg}` },
      { status: 500 }
    )
  }
}
