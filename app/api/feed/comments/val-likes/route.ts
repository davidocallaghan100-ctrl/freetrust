import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VAL_USER_ID = 'daaaf071-1625-4e49-a94b-3450a5834c0c'

export async function GET(req: NextRequest) {
  try {
    const ids = req.nextUrl.searchParams.get('ids')
    if (!ids) return NextResponse.json({ likedIds: [], userLikedIds: [] })

    const commentIds = ids.split(',').filter(Boolean).slice(0, 50)
    if (commentIds.length === 0) return NextResponse.json({ likedIds: [], userLikedIds: [] })

    const admin = createAdminClient()

    // Val's likes
    const { data: valData } = await admin
      .from('feed_comment_likes')
      .select('comment_id')
      .eq('user_id', VAL_USER_ID)
      .in('comment_id', commentIds)

    const likedIds = (valData ?? []).map((r: { comment_id: string }) => r.comment_id)

    // Current user's likes
    let userLikedIds: string[] = []
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user && user.id !== VAL_USER_ID) {
        const { data: userData } = await admin
          .from('feed_comment_likes')
          .select('comment_id')
          .eq('user_id', user.id)
          .in('comment_id', commentIds)
        userLikedIds = (userData ?? []).map((r: { comment_id: string }) => r.comment_id)
      }
    } catch { /* not logged in — userLikedIds stays [] */ }

    return NextResponse.json({ likedIds, userLikedIds })
  } catch (err) {
    console.error('[val-likes]', err)
    return NextResponse.json({ likedIds: [], userLikedIds: [] })
  }
}
