export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/stories/share-post
// Body: { post_id: string }
// Calls the share_post_as_story RPC (SECURITY DEFINER) to snapshot a feed
// post and publish it as a new 24h Story owned by the current user. Any
// authenticated user may share any post they can see — the RPC itself
// raises "Post not found" if the id doesn't resolve, which we surface as a
// 404 here (there's no separate "not authorized" case since sharing doesn't
// require ownership of the original post).
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { post_id?: string }
    if (!body.post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 })
    }

    const { data: storyId, error } = await supabase.rpc('share_post_as_story', { p_post_id: body.post_id })
    if (error) {
      const isNotFound = /not found/i.test(error.message)
      return NextResponse.json({ error: error.message }, { status: isNotFound ? 404 : 500 })
    }

    return NextResponse.json({ storyId })
  } catch (err) {
    console.error('[POST /api/stories/share-post]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
