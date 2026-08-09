export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/build/conversations — list the current user's Build conversations, newest first.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('build_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/build/conversations]', error)
      return NextResponse.json({ error: 'Could not load conversations' }, { status: 500 })
    }

    return NextResponse.json({ conversations: data ?? [] })
  } catch (err) {
    console.error('[GET /api/build/conversations] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// POST /api/build/conversations — create a new (empty) conversation.
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({})) as { title?: string }
    const title = body.title?.trim().slice(0, 120) || 'Untitled design'

    const { data, error } = await supabase
      .from('build_conversations')
      .insert({ user_id: user.id, title })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      console.error('[POST /api/build/conversations]', error)
      return NextResponse.json({ error: 'Could not create conversation' }, { status: 500 })
    }

    return NextResponse.json({ conversation: data })
  } catch (err) {
    console.error('[POST /api/build/conversations] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
