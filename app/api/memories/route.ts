export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/memories?userId=<profile id>
// Public (memories select policy is `using (true)`) — returns a member's
// saved memories, most recent first. Used by the profile page's Memories tab.
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: memories, error } = await supabase
      .from('memories')
      .select('id, user_id, story_id, media_url, media_type, caption, original_created_at, saved_at')
      .eq('user_id', userId)
      .order('original_created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ memories: memories ?? [] })
  } catch (err) {
    console.error('[GET /api/memories]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
