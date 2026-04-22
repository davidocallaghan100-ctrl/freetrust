export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/feed/posts/[id]/vote { optionIdx: number }
// - Inserts or updates the user's vote (one vote per user per poll)
// - Sending same optionIdx again removes the vote (toggle off)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({})) as { optionIdx?: number }
    const optionIdx = body.optionIdx
    if (typeof optionIdx !== 'number' || optionIdx < 0) {
      return NextResponse.json({ error: 'Invalid optionIdx' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check existing vote
    const { data: existing } = await admin
      .from('poll_votes')
      .select('id, option_idx')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    let userVote: number | null = null

    if (existing) {
      if ((existing as { id: string; option_idx: number }).option_idx === optionIdx) {
        // Toggle off — same option clicked again
        await admin.from('poll_votes').delete().eq('id', (existing as { id: string }).id)
        userVote = null
      } else {
        // Switch to different option
        await admin
          .from('poll_votes')
          .update({ option_idx: optionIdx })
          .eq('id', (existing as { id: string }).id)
        userVote = optionIdx
      }
    } else {
      const { error: insertErr } = await admin
        .from('poll_votes')
        .insert({ post_id: postId, user_id: user.id, option_idx: optionIdx })
      if (insertErr) {
        console.error('[vote] insert error:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
      userVote = optionIdx
    }

    // Get fresh vote counts per option
    const { data: votes } = await admin
      .from('poll_votes')
      .select('option_idx')
      .eq('post_id', postId)

    const counts: Record<number, number> = {}
    for (const v of (votes ?? []) as { option_idx: number }[]) {
      counts[v.option_idx] = (counts[v.option_idx] ?? 0) + 1
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    return NextResponse.json({ user_vote: userVote, counts, total })
  } catch (err) {
    console.error('[POST /api/feed/posts/[id]/vote]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
