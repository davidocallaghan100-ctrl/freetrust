import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/reviews/[id] — reply or report
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
      .select('reviewee_id, reviewer_id, reported')
      .eq('id', id)
      .single()

    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })

    if (action === 'reply') {
      // Only reviewee can reply
      if (review.reviewee_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const { data: updated, error } = await supabase
        .from('reviews')
        .update({ reply: reply?.slice(0, 500), reply_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ review: updated })
    }

    if (action === 'report') {
      if (review.reported) return NextResponse.json({ error: 'Already reported' }, { status: 409 })
      const { data: updated, error } = await supabase
        .from('reviews')
        .update({ reported: true, report_reason })
        .eq('id', id)
        .select()
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ review: updated })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/reviews/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
