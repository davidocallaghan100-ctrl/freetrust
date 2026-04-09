import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VAL_USER_ID = 'daaaf071-1625-4e49-a94b-3450a5834c0c'

export async function GET(req: NextRequest) {
  try {
    const ids = req.nextUrl.searchParams.get('ids')
    if (!ids) return NextResponse.json({ likedIds: [] })

    const commentIds = ids.split(',').filter(Boolean).slice(0, 50)
    if (commentIds.length === 0) return NextResponse.json({ likedIds: [] })

    const supabase = createAdminClient()
    const { data } = await supabase
      .from('feed_comment_likes')
      .select('comment_id')
      .eq('user_id', VAL_USER_ID)
      .in('comment_id', commentIds)

    const likedIds = (data ?? []).map((r: { comment_id: string }) => r.comment_id)
    return NextResponse.json({ likedIds })
  } catch (err) {
    console.error('[val-likes]', err)
    return NextResponse.json({ likedIds: [] })
  }
}
