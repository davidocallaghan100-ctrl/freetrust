export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: 'Could not load blocks' }, { status: 500 })
    return NextResponse.json({ blocks: data ?? [] })
  } catch (err) {
    console.error('[moderation/blocks]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
