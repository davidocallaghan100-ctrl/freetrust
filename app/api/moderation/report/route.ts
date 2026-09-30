export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_REASONS = new Set(['harassment', 'hate', 'spam', 'scam', 'nudity', 'violence', 'misleading', 'other'])

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const reportedUserId = cleanText(body.reported_user_id, 80)
    const postId = cleanText(body.post_id, 160)
    const contentType = cleanText(body.content_type, 40) ?? 'post'
    const reason = cleanText(body.reason, 40) ?? 'other'
    const details = cleanText(body.details, 1000)

    if (!reportedUserId && !postId) {
      return NextResponse.json({ error: 'Reported member or content is required' }, { status: 400 })
    }
    if (reportedUserId === user.id) {
      return NextResponse.json({ error: 'You cannot report yourself' }, { status: 400 })
    }
    if (!ALLOWED_REASONS.has(reason)) {
      return NextResponse.json({ error: 'Invalid report reason' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('content_reports')
      .insert({
        reporter_id: user.id,
        reported_user_id: reportedUserId,
        post_id: postId,
        content_type: contentType,
        reason,
        details,
        metadata: { source: 'post_card' },
      })
      .select('id, status, created_at')
      .single()

    if (error) {
      console.error('[moderation/report]', error)
      return NextResponse.json({ error: 'Could not submit report' }, { status: 500 })
    }

    return NextResponse.json({ success: true, report: data })
  } catch (err) {
    console.error('[moderation/report]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
