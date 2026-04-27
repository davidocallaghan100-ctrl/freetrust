export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyAllMembersNewPost } from '@/lib/notifications/new-post-fanout'

// GET /api/cron/scheduled-post-fanout
// Runs every 15 minutes (see vercel.json).
// Finds feed posts that just became visible (created_at in the last 20 mins)
// and fires the member notification fanout for each one that hasn't been
// fanned out yet. This handles posts inserted with a future timestamp
// (scheduled posts) that bypass the normal /api/feed/post creation flow.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date()
    const windowStart = new Date(now.getTime() - 20 * 60 * 1000).toISOString()
    const windowEnd = now.toISOString()

    // Find posts that just became visible in the 20-minute window
    const { data: posts, error: postsErr } = await admin
      .from('feed_posts')
      .select('id, user_id, content, profiles!feed_posts_user_id_fkey(full_name)')
      .gte('created_at', windowStart)
      .lte('created_at', windowEnd)

    if (postsErr) {
      console.error('[cron/scheduled-post-fanout] posts query error:', postsErr.message)
      return NextResponse.json({ error: postsErr.message }, { status: 500 })
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ ok: true, fanned_out: 0, message: 'No posts in window' })
    }

    console.log(`[cron/scheduled-post-fanout] found ${posts.length} post(s) in window`)

    let fanoutCount = 0
    for (const post of posts) {
      // Try to claim this post for fanout using an idempotency log table.
      // If the table doesn't exist yet, we fall through and send anyway
      // (better to notify once than to miss it entirely on first deploy).
      let alreadySent = false
      try {
        const { error: logErr } = await admin
          .from('cron_fanout_log')
          .insert({ post_id: post.id, fanned_out_at: now.toISOString() })
        if (logErr) {
          if (logErr.code === '23505') {
            // Unique constraint violation — already fanned out, skip
            console.log(`[cron/scheduled-post-fanout] post ${post.id} already fanned out, skipping`)
            alreadySent = true
          } else {
            // Other error (e.g. table not yet created) — log and proceed
            console.warn(`[cron/scheduled-post-fanout] fanout log insert warning for ${post.id}:`, logErr.message)
          }
        }
      } catch (logEx) {
        console.warn('[cron/scheduled-post-fanout] fanout log unavailable, proceeding anyway:', logEx)
      }

      if (alreadySent) continue

      const profile = Array.isArray(post.profiles) ? post.profiles[0] : post.profiles
      const authorName = (profile as { full_name?: string | null } | null)?.full_name ?? 'FreeTrust'
      const contentPreview = (post.content ?? '').slice(0, 120)

      console.log(`[cron/scheduled-post-fanout] fanning out post ${post.id} by ${authorName}`)

      await notifyAllMembersNewPost({
        postId: post.id,
        authorId: post.user_id,
        authorName,
        contentPreview,
      })

      fanoutCount++
    }

    return NextResponse.json({ ok: true, fanned_out: fanoutCount, posts_in_window: posts.length })
  } catch (err) {
    console.error('[cron/scheduled-post-fanout] unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
