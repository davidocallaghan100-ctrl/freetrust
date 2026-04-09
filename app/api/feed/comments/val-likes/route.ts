import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Kept at this path for backwards compat — now returns only the current user's liked comment IDs
export async function GET(req: NextRequest) {
  try {
    const ids = req.nextUrl.searchParams.get('ids')
    if (!ids) return NextResponse.json({ likedIds: [], userLikedIds: [] })

    const commentIds = ids.split(',').filter(Boolean).slice(0, 50)
    if (commentIds.length === 0) return NextResponse.json({ likedIds: [], userLikedIds: [] })

    let userLikedIds: string[] = []
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = createAdminClient()
        const { data } = await admin
          .from('feed_comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds)
        userLikedIds = (data ?? []).map((r: { comment_id: string }) => r.comment_id)
      }
    } catch { /* not logged in */ }

    return NextResponse.json({ likedIds: userLikedIds, userLikedIds })
  } catch (err) {
    console.error('[comment-likes]', err)
    return NextResponse.json({ likedIds: [], userLikedIds: [] })
  }
}
