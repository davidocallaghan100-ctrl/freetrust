export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/stories/[id]/save-as-memory
// Calls the save_story_as_memory RPC (SECURITY DEFINER, owner-only — the RPC
// itself raises if auth.uid() doesn't own the story, which we surface as a
// 403 here).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: memoryId, error } = await supabase.rpc('save_story_as_memory', { p_story_id: id })
    if (error) {
      const isAuthz = /not authorized|not found/i.test(error.message)
      return NextResponse.json({ error: error.message }, { status: isAuthz ? 403 : 500 })
    }

    return NextResponse.json({ memoryId })
  } catch (err) {
    console.error('[POST /api/stories/[id]/save-as-memory]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
