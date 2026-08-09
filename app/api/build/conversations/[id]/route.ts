export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/build/conversations/[id] — full conversation: messages + sections.
// RLS on all three tables scopes everything to the current user already,
// but we still explicitly check ownership of the conversation row so we
// can return a clean 404 instead of an empty-but-200 payload.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: conversation, error: convError } = await supabase
      .from('build_conversations')
      .select('id, title, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (convError) {
      console.error('[GET /api/build/conversations/:id] conv error', convError)
      return NextResponse.json({ error: 'Could not load conversation' }, { status: 500 })
    }
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const [messagesRes, sectionsRes] = await Promise.all([
      supabase
        .from('build_messages')
        .select('id, role, content, design_spec, image_urls, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('build_sections')
        .select('section_key, content, cost_spent, generated_at, updated_at')
        .eq('conversation_id', id),
    ])

    if (messagesRes.error) {
      console.error('[GET /api/build/conversations/:id] messages error', messagesRes.error)
      return NextResponse.json({ error: 'Could not load messages' }, { status: 500 })
    }

    // Latest design spec = the most recent message that has one.
    const messages = messagesRes.data ?? []
    let latestSpec = null
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].design_spec) { latestSpec = messages[i].design_spec; break }
    }

    return NextResponse.json({
      conversation,
      messages,
      sections: sectionsRes.data ?? [],
      latestDesignSpec: latestSpec,
    })
  } catch (err) {
    console.error('[GET /api/build/conversations/:id] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}

// DELETE /api/build/conversations/[id] — remove a conversation the user owns.
// Cascades to messages/sections via FK ON DELETE CASCADE.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('build_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('[DELETE /api/build/conversations/:id]', error)
      return NextResponse.json({ error: 'Could not delete conversation' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/build/conversations/:id] unexpected', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
