export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Participation check uses the admin (service-role) client so it
// bypasses RLS cleanly. We've already validated `user.id` from the
// auth session via the user-session client, so looking up whether
// that id has a row in conversation_participants for the given
// conversation is safe to do with the admin client — the caller
// cannot spoof a different user id.
//
// Why this matters: the user-session client is subject to RLS on
// conversation_participants. If the production DB is still on the
// broken self-referential participants_select policy (fixed by
// 20260415000009_messaging_rls.sql but not applied yet in every
// environment), the SELECT raises infinite-recursion, `data` is
// null, and the route returns 403. The /messages/[id] page then
// redirects to /messages, which looks from the user's side like
// "the Message button goes to the inbox instead of the thread".
async function assertParticipant(conversationId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('conversation_participants')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('user_id',         userId)
    .maybeSingle()
  if (error) {
    console.error('[api/messages/:id] participation check failed:', error)
    return false
  }
  return !!data
}

// GET /api/messages/[conversationId] — list messages in conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = params

    const isParticipant = await assertParticipant(conversationId, user.id)
    if (!isParticipant) {
      return NextResponse.json(
        { error: 'Not a participant in this conversation' },
        { status: 403 },
      )
    }

    // Message fetch also via admin client for the same reason —
    // the message_select RLS policy subqueries conversation_
    // participants, so it also trips the infinite-recursion bug
    // on a DB that hasn't had the fix applied yet.
    const admin = createAdminClient()
    const { data: messages, error: msgErr } = await admin
      .from('messages')
      .select('*, sender:profiles(id, full_name, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgErr) {
      console.error('[GET /api/messages/:id] messages fetch failed:', msgErr)
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // Mark as read — update last_read_at on the caller's
    // participant row. Also admin-client so RLS can't block it.
    await admin
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id',         user.id)

    return NextResponse.json({ messages: messages || [] })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/messages/:id]', msg, err)
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages/[conversationId] — send a message in conversation
export async function POST(
  request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId } = params
    const body = await request.json().catch(() => null) as { content?: unknown } | null
    const rawContent = body?.content
    if (typeof rawContent !== 'string' || !rawContent.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }
    const content = rawContent.trim()

    const isParticipant = await assertParticipant(conversationId, user.id)
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    const admin = createAdminClient()

    // Insert message via the admin client for the same reason as
    // the GET path — decouples from the RLS migration having run.
    const { data: message, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id:       user.id,
        content,
      })
      .select()
      .single()

    if (msgErr) {
      console.error('[POST /api/messages/:id] insert failed:', msgErr)
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // Update conversation timestamp + sender last_read_at. Both
    // via admin client. Done in parallel since they're independent.
    const nowIso = new Date().toISOString()
    await Promise.all([
      admin
        .from('conversations')
        .update({ updated_at: nowIso, last_message_at: nowIso })
        .eq('id', conversationId),
      admin
        .from('conversation_participants')
        .update({ last_read_at: nowIso })
        .eq('conversation_id', conversationId)
        .eq('user_id',         user.id),
    ])

    return NextResponse.json({ message })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/messages/:id]', msg, err)
    return NextResponse.json({ error: msg || 'Internal server error' }, { status: 500 })
  }
}
