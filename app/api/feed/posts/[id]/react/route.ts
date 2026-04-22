export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { sendPushNotification } from '@/lib/push/sendPushNotification'

const VALID = new Set(['trust', 'love', 'insightful', 'collab'])

// POST /api/feed/posts/[id]/react { type }
// - If user has no reaction → insert
// - If user has the same reaction → delete (toggle off)
// - If user has a different reaction → update
// Returns the new per-type counts and the user's current reaction.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { type?: string }
    const type = (body.type ?? '').trim().toLowerCase()
    if (!VALID.has(type)) {
      return NextResponse.json({ error: 'Invalid reaction type' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Check existing reaction
    const { data: existing } = await admin
      .from('feed_reactions')
      .select('id, reaction_type')
      .eq('post_id', postId)
      .eq('user_id', user.id)
      .maybeSingle()

    let userReaction: string | null = null

    if (existing) {
      if (existing.reaction_type === type) {
        // Toggle off
        await admin.from('feed_reactions').delete().eq('id', existing.id)
        userReaction = null
      } else {
        // Change reaction type
        await admin
          .from('feed_reactions')
          .update({ reaction_type: type })
          .eq('id', existing.id)
        userReaction = type
      }
    } else {
      const { error: insertErr } = await admin
        .from('feed_reactions')
        .insert({ post_id: postId, user_id: user.id, reaction_type: type })
      if (insertErr) {
        // If table doesn't exist yet, return a clear error
        if (insertErr.code === '42P01') {
          return NextResponse.json({ error: 'Reactions not set up — run the feed_reactions migration' }, { status: 500 })
        }
        console.error('[react] insert error:', insertErr)
        return NextResponse.json({ error: insertErr.message }, { status: 500 })
      }
      userReaction = type

      // Notify the post author on a new reaction (fire-and-forget,
      // preference-checked, skips self-reactions). Only fires on the
      // initial insert path — not on switch-type updates.
      const { data: postData } = await admin
        .from('feed_posts')
        .select('user_id')
        .eq('id', postId)
        .maybeSingle()
      if (postData?.user_id && postData.user_id !== user.id) {
        const { data: reactor } = await admin
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle()
        const reactorName = reactor?.full_name ?? 'Someone'
        sendEmail({
          type: 'new_reaction',
          userId: postData.user_id,
          payload: { reactorName, reactionType: type, postId },
        }).catch(() => {})
        sendPushNotification({
          userId: postData.user_id,
          title: `${reactorName} reacted to your post`,
          message: `They gave it a "${type}" reaction`,
          url: `/feed/${postId}`,
        }).catch(() => {})
      }
    }

    // Compute fresh counts per type
    const { data: rows } = await admin
      .from('feed_reactions')
      .select('reaction_type')
      .eq('post_id', postId)

    const counts: Record<string, number> = { trust: 0, love: 0, insightful: 0, collab: 0 }
    for (const r of rows ?? []) {
      const t = (r as { reaction_type: string }).reaction_type
      if (t in counts) counts[t]++
    }
    const total = counts.trust + counts.love + counts.insightful + counts.collab

    return NextResponse.json({ user_reaction: userReaction, counts, total })
  } catch (err) {
    console.error('[POST /api/feed/posts/[id]/react] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
