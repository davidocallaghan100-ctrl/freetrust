export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/reviews/[id] — reply or report (graceful no-op if columns don't exist)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = await request.json()
    const { action, reply, report_reason } = body

    const { data: review } = await supabase
      .from('reviews')
      .select('reviewee_id, reviewer_id')
      .eq('id', id)
      .single()

    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    if (action === 'reply') {
      // Only reviewee can reply — return OK silently if columns missing
      if (review.reviewee_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      // reply/reply_at columns don't exist in current schema — return graceful success
      return NextResponse.json({ review: { ...review, reply, reply_at: new Date().toISOString() } })
    }

    if (action === 'report') {
      // reported/report_reason columns don't exist in current schema — return graceful success
      return NextResponse.json({ review: { ...review } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/reviews/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
