export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/stories/[id]/views
// Owner-only viewers list (the "eye icon → viewers sheet" in the story
// viewer). RLS on story_views ("story_views select as owner") already
// restricts rows to stories the caller owns, so a non-owner request simply
// gets an empty list rather than an error — matches the negative-test
// expectation that viewing another user's data returns nothing, not a 500.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: views, error } = await supabase
      .from('story_views')
      .select('viewer_id, viewed_at, profiles!viewer_id(id, full_name, avatar_url)')
      .eq('story_id', id)
      .order('viewed_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ views: views ?? [] })
  } catch (err) {
    console.error('[GET /api/stories/[id]/views]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
