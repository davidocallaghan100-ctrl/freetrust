export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getAutoDeleteCutoffIso(days: unknown): string | null {
  if (!Number.isInteger(days) || typeof days !== 'number' || days <= 0) return null
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// GET /api/messages — list conversations for current user
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use the admin client for message/conversation reads. Some older
    // production RLS policies on conversation_participants can hide rows or
    // recurse for the user-session client, which makes the inbox look empty
    // even though direct conversation pages still load through the admin-backed
    // /api/messages/:id route.
    const admin = createAdminClient()

    // Get all conversation IDs the user is part of
    const { data: participantRows, error: partErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)

    const { data: adminParticipantRows, error: adminPartErr } = partErr || !participantRows || participantRows.length === 0
      ? await admin
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)
      : { data: participantRows, error: null }

    if (adminPartErr) {
      return NextResponse.json({ error: adminPartErr.message }, { status: 500 })
    }

    const visibleParticipantRows = adminParticipantRows ?? []

    if (visibleParticipantRows.length === 0) {
      return NextResponse.json({ conversations: [] })
    }

    const convIds = visibleParticipantRows.map(p => p.conversation_id)

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('message_auto_delete_days')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    const autoDeleteCutoffIso = getAutoDeleteCutoffIso(profile?.message_auto_delete_days)

    // Get conversations first, then enrich participants with profiles in a
    // separate query. Production does not currently expose a PostgREST FK
    // relationship from conversation_participants.user_id -> profiles.id, so
    // nested `profile:profiles(...)` fails with PGRST200 and the client keeps
    // rendering an empty inbox even though the message drawer can load threads.
    const { data: conversations, error: convErr } = await admin
      .from('conversations')
      .select(`
        id,
        updated_at,
        last_message_at
      `)
      .in('id', convIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convErr) {
      return NextResponse.json({ error: convErr.message }, { status: 500 })
    }

    const { data: allParticipants, error: allParticipantsErr } = await admin
      .from('conversation_participants')
      .select('conversation_id, user_id, last_read_at')
      .in('conversation_id', convIds)

    if (allParticipantsErr) {
      return NextResponse.json({ error: allParticipantsErr.message }, { status: 500 })
    }

    const participantUserIds = Array.from(new Set((allParticipants ?? [])
      .map(p => p.user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)))

    const { data: participantProfiles, error: participantProfilesErr } = participantUserIds.length > 0
      ? await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', participantUserIds)
      : { data: [], error: null }

    if (participantProfilesErr) {
      return NextResponse.json({ error: participantProfilesErr.message }, { status: 500 })
    }

    const profileById = new Map((participantProfiles ?? []).map(profile => [profile.id, profile]))
    const participantsByConversation = new Map<string, Array<{ user_id: string; last_read_at: string | null }>>()
    for (const participant of allParticipants ?? []) {
      if (typeof participant.conversation_id !== 'string' || typeof participant.user_id !== 'string') continue
      const rows = participantsByConversation.get(participant.conversation_id) ?? []
      rows.push({ user_id: participant.user_id, last_read_at: participant.last_read_at ?? null })
      participantsByConversation.set(participant.conversation_id, rows)
    }

    // Get last message for each conversation
    const enriched = await Promise.all((conversations || []).map(async (conv) => {
      const { data: lastMsg } = await admin
        .from('messages')
        .select('id, sender_id, content, created_at, attachments, sender:profiles(id, full_name, avatar_url)')
        .eq('conversation_id', conv.id)
        .gte('created_at', autoDeleteCutoffIso ?? '0001-01-01T00:00:00.000Z')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      // Calculate unread count
      const myParticipant = visibleParticipantRows.find(p => p.conversation_id === conv.id)
      const lastReadAt = myParticipant?.last_read_at
      let unreadCount = 0
      if (lastReadAt) {
        const { count } = await admin
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt)
          .gte('created_at', autoDeleteCutoffIso ?? '0001-01-01T00:00:00.000Z')
        unreadCount = count || 0
      }

      // Get other participant
      const otherParticipant = (participantsByConversation.get(conv.id) ?? [])
        .find(p => p.user_id !== user.id)
      const otherProfile = otherParticipant ? profileById.get(otherParticipant.user_id) : null

      return {
        id: conv.id,
        updated_at: conv.updated_at,
        last_message: lastMsg || null,
        unread_count: unreadCount,
        other_user: otherProfile || null,
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

    const body = await request.json()
    const { recipientId, content, conversationId: existingConvId } = body

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Message content is required' }, { status: 400 })
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
