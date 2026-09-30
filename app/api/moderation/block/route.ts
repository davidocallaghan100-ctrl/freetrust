export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function cleanId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, 80) : null
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const blockedId = cleanId(body.blocked_user_id)
    const postId = typeof body.post_id === 'string' ? body.post_id.trim().slice(0, 160) : null
    if (!blockedId) return NextResponse.json({ error: 'Blocked member is required' }, { status: 400 })
    if (blockedId === user.id) return NextResponse.json({ error: 'You cannot block yourself' }, { status: 400 })

    const { error: blockError } = await supabase
      .from('user_blocks')
      .upsert({ blocker_id: user.id, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' })

    if (blockError) {
      console.error('[moderation/block]', blockError)
      return NextResponse.json({ error: 'Could not block member' }, { status: 500 })
    }

    // Blocking also creates a moderation queue signal, satisfying Apple's
    // requirement that abusive-user blocks notify the developer for review.
    await supabase.from('content_reports').insert({
      reporter_id: user.id,
      reported_user_id: blockedId,
      post_id: postId,
      content_type: 'member_block',
      reason: 'blocked_user',
      details: 'Member blocked from post safety menu.',
      metadata: { source: 'block_action' },
    })

    return NextResponse.json({ success: true, blocked_user_id: blockedId })
  } catch (err) {
    console.error('[moderation/block]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const blockedId = cleanId(searchParams.get('blocked_user_id'))
    if (!blockedId) return NextResponse.json({ error: 'Blocked member is required' }, { status: 400 })

    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId)

    if (error) return NextResponse.json({ error: 'Could not unblock member' }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[moderation/block DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
