export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/memories/[id]/repost
// Calls repost_memory_as_story RPC (SECURITY DEFINER, owner-only). Creates a
// brand-new stories row with a fresh 24h expiry — the original memory and
// any prior story rows are left untouched.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: newStoryId, error } = await supabase.rpc('repost_memory_as_story', { p_memory_id: id })
    if (error) {
      const isAuthz = /not authorized|not found/i.test(error.message)
      return NextResponse.json({ error: error.message }, { status: isAuthz ? 403 : 500 })
    }

    return NextResponse.json({ storyId: newStoryId })
  } catch (err) {
    console.error('[POST /api/memories/[id]/repost]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
