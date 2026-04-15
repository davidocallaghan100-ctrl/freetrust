export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { applyApiRateLimit } from '@/lib/security/api-helpers'

// GET /api/messages — list conversations for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all conversation IDs the user is part of
    const { data: participantRows, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)

    if (partErr) {
      return NextResponse.json({ error: partErr.message }, { status: 500 })
    }

    if (!participantRows || participantRows.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const convIds = participantRows.map(p => p.conversation_id)

    // Get conversations with last message
    const { data: conversations, error: convErr } = await supabase
      .from('conversations')
      .select(`
        id,
        updated_at,
        last_message_at,
        participants:conversation_participants(
          user_id,
          last_read_at,
          profile:profiles(id, full_name, avatar_url)
        )
      `)
      .in('id', convIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convErr) {
      return NextResponse.json({ error: convErr.message }, { status: 500 })
    }

    // Get last message for each conversation
    const enriched = await Promise.all((conversations || []).map(async (conv) => {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Calculate unread count
      const myParticipant = participantRows.find(p => p.conversation_id === conv.id)
      const lastReadAt = myParticipant?.last_read_at
      let unreadCount = 0
      if (lastReadAt) {
        const { count } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt)
        unreadCount = count || 0
      }

      // Get other participant
      const otherParticipant = (conv.participants as unknown as Array<{ user_id: string; profile: { id: string; full_name: string | null; avatar_url: string | null } }>)
        .find(p => p.user_id !== user.id)

      return {
        id: conv.id,
        updated_at: conv.updated_at,
        last_message: lastMsg || null,
        unread_count: unreadCount,
        other_user: otherParticipant?.profile || null,
      }
    }))

    return NextResponse.json({ conversations: enriched })
  } catch (err) {
    console.error('[GET /api/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages — send a message (creates conversation if needed)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit — 100 req/min per user. Caps spam/flood from a
    // compromised session without blocking legitimate fast-typers.
    const rateLimitResponse = applyApiRateLimit(request, user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()
    const { recipientId, content, conversationId: existingConvId } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
    }
    // Message max length — prevent 10MB messages being used as a
    // storage abuse vector. 5000 chars is generous for conversation.
    if (typeof content !== 'string' || content.length > 5000) {
      return NextResponse.json({ error: 'Message too long (max 5000 chars)' }, { status: 400 })
    }

    let convId = existingConvId

    if (!convId) {
      if (!recipientId) {
        return NextResponse.json({ error: 'recipientId required when starting new conversation' }, { status: 400 })
      }

      // Check if conversation already exists between these two users
      const { data: myParticipations } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      if (myParticipations && myParticipations.length > 0) {
        const myConvIds = myParticipations.map(p => p.conversation_id)
        const { data: shared } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', recipientId)
          .in('conversation_id', myConvIds)

        if (shared && shared.length > 0) {
          convId = shared[0].conversation_id
        }
      }

      if (!convId) {
        // Create new conversation
        const { data: newConv, error: convErr } = await supabase
          .from('conversations')
          .insert({ last_message_at: new Date().toISOString() })
          .select()
          .single()

        if (convErr || !newConv) {
          return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
        }

        convId = newConv.id

        // Add both participants
        await supabase.from('conversation_participants').insert([
          { conversation_id: convId, user_id: user.id, last_read_at: new Date().toISOString() },
          { conversation_id: convId, user_id: recipientId },
        ])
      }
    }

    // Insert message
    const { data: message, error: msgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        sender_id: user.id,
        content: content.trim(),
        status: 'sent',
      })
      .select()
      .single()

    if (msgErr) {
      return NextResponse.json({ error: msgErr.message }, { status: 500 })
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString(), last_message_at: new Date().toISOString() })
      .eq('id', convId)

    // Update sender's last_read_at
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', user.id)

    return NextResponse.json({ message, conversation_id: convId })
  } catch (err) {
    console.error('[POST /api/messages]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
