export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/stories/[id]/view
// Calls the record_story_view RPC (SECURITY DEFINER) which dedupes per
// (story_id, viewer_id) and increments stories.view_count only on the first
// view. Called by the story viewer whenever a story is displayed.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase.rpc('record_story_view', { p_story_id: id })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[POST /api/stories/[id]/view]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
