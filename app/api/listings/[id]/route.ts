export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toPgTagArray, toPgUrlArray } from '@/lib/supabase/text-array'

// GET /api/listings/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: listing, error } = await supabase
      .from('listings')
      .select('*, profiles!seller_id(id, full_name, avatar_url, bio)')
      .eq('id', params.id)
      .single()

    if (error || !listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    // Increment view count (fire-and-forget)
    supabase
      .from('listings')
      .update({ views: (listing.views ?? 0) + 1 })
      .eq('id', params.id)
      .then(() => {})

    return NextResponse.json({ listing })
  } catch (err) {
    console.error('[GET /api/listings/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/listings/[id]
//
// Accepts partial updates to a listing the caller owns. The allowlist below
// is the superset of every column the edit UI writes — any new writable
// column needs to be added here or it'll be silently dropped.
//
// text[] columns (tags, images) are run through toPgTagArray / toPgUrlArray
// to sidestep the PostgREST JSON → text[] coercion bug ("The string did not
// match the expected pattern"). See lib/supabase/text-array.ts for history.
//
// Every supabase error is logged in full (code, details, hint, message) and
// surfaced back to the client in a `detail` field so failures are diagnosable
// from both Vercel logs and the browser without extra round-trips.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Superset of every column the edit form (app/products/[id]/edit/page.tsx)
    // is allowed to write. Keep in sync with that form's `updates` object.
    const allowed = [
      'title',
      'description',
      'price',
      'currency',
      'status',
      'tags',
      'images',
      'cover_image',
      'category',
      'category_id',
      'product_type',
      'stock_qty',
      'condition',
      'shipping_options',
    ] as const
    type AllowedKey = typeof allowed[number]
    const updates: Partial<Record<AllowedKey, unknown>> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    // Re-encode text[] columns as Postgres array literals so the PostgREST
    // coercion path can't reject them with "expected pattern".
    if ('tags' in updates) {
      updates.tags = toPgTagArray(updates.tags as unknown[])
    }
    if ('images' in updates) {
      updates.images = toPgUrlArray(updates.images)
    }

    const { data: listing, error } = await supabase
      .from('listings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('seller_id', user.id) // ensure ownership
      .select()
      .single()

    if (error) {
      // Log every diagnostic field PostgREST / Supabase gives us so Vercel
      // logs contain enough context to diagnose without re-running locally.
      console.error('[PATCH /api/listings/[id]] supabase error', {
        listingId: params.id,
        userId: user.id,
        updateKeys: Object.keys(updates),
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })
      return NextResponse.json(
        {
          error: error.message,
          detail: {
            code: error.code ?? null,
            details: error.details ?? null,
            hint: error.hint ?? null,
          },
        },
        { status: 500 }
      )
    }
    if (!listing) {
      return NextResponse.json({ error: 'Not found or not authorised' }, { status: 404 })
    }

    return NextResponse.json({ listing })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack   = err instanceof Error ? err.stack   : undefined
    console.error('[PATCH /api/listings/[id]] Unexpected error:', message, stack)
    return NextResponse.json({ error: `Internal server error: ${message}` }, { status: 500 })
  }
}

// DELETE /api/listings/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if admin — admins can delete any listing
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    const isAdmin = profile?.role === 'admin'

    let query = supabase.from('listings').delete().eq('id', params.id)
    if (!isAdmin) query = query.eq('seller_id', user.id)

    const { error } = await query
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/listings/[id]] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
