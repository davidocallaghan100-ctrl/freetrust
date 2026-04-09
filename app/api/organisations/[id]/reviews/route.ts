export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const orgId = params.id

  const { data, error } = await supabase
    .from('organisation_reviews')
    .select(`
      id, rating, title, content, created_at,
      reviewer:profiles!organisation_reviews_reviewer_id_fkey(id, full_name, avatar_url, username, trust_balance)
    `)
    .eq('organisation_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[org reviews GET]', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }

  const reviews = data ?? []
  const avg =
    reviews.length > 0
      ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
      : null

  return NextResponse.json({ reviews, count: reviews.length, avg })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const orgId = params.id
  const body = await req.json()
  const { rating, title, content } = body

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1–5' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Review content is required' }, { status: 400 })
  }

  // Check for existing review (upsert via unique constraint)
  const { data, error } = await supabase
    .from('organisation_reviews')
    .upsert(
      { organisation_id: orgId, reviewer_id: user.id, rating, title: title?.trim() || null, content: content.trim() },
      { onConflict: 'organisation_id,reviewer_id' }
    )
    .select(`
      id, rating, title, content, created_at,
      reviewer:profiles!organisation_reviews_reviewer_id_fkey(id, full_name, avatar_url, username, trust_balance)
    `)
    .single()

  if (error) {
    console.error('[org reviews POST]', error)
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 })
  }

  return NextResponse.json({ review: data })
}
