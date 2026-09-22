export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface InboxRow {
  conversation_id: string
  conv_updated_at: string
  last_message_at: string | null
  last_message_id: string | null
  last_message_sender_id: string | null
  last_message_content: string | null
  last_message_created_at: string | null
  last_message_attachments: unknown
  unread_count: number
  other_user_id: string | null
}

interface InboxConversation {
  id: string
  updated_at: string
  last_message: {
    id: string
    conversation_id: string
    sender_id: string
    content: string | null
    created_at: string
    attachments: unknown
  } | null
  unread_count: number
  other_user: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

function getAutoDeleteCutoffIso(days: unknown): string | null {
  if (!Number.isInteger(days) || typeof days !== 'number' || days <= 0) return null
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * Safe fallback for databases that have not received the inbox-performance
 * migration yet. The RPC is an optimisation, not a requirement for showing a
 * member's conversations; an unavailable RPC must never be presented as an
 * empty inbox.
 */
async function loadInboxFallback(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  autoDeleteCutoffIso: string | null,
): Promise<{ conversations: InboxConversation[]; totalUnreadCount: number }> {
  const { data: participantRows, error: participantErr } = await admin
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId)

  if (participantErr) throw new Error(participantErr.message)

  const visibleParticipantRows = participantRows ?? []
  if (visibleParticipantRows.length === 0) {
    return { conversations: [], totalUnreadCount: 0 }
  }

  const conversationIds = visibleParticipantRows.map(row => row.conversation_id)
  const [{ data: conversations, error: conversationsErr }, { data: allParticipants, error: allParticipantsErr }] = await Promise.all([
    admin
      .from('conversations')
      .select('id, updated_at, last_message_at')
      .in('id', conversationIds)
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    admin
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', conversationIds),
  ])

  if (conversationsErr) throw new Error(conversationsErr.message)
  if (allParticipantsErr) throw new Error(allParticipantsErr.message)

  const participantUserIds = Array.from(new Set((allParticipants ?? [])
    .map(row => row.user_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)))

  const { data: participantProfiles, error: profilesErr } = participantUserIds.length > 0
    ? await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', participantUserIds)
    : { data: [], error: null }

  if (profilesErr) throw new Error(profilesErr.message)

  const profileById = new Map((participantProfiles ?? []).map(profile => [profile.id, profile]))
  const participantsByConversation = new Map<string, string[]>()
  for (const participant of allParticipants ?? []) {
    if (typeof participant.conversation_id !== 'string' || typeof participant.user_id !== 'string') continue
    const rows = participantsByConversation.get(participant.conversation_id) ?? []
    rows.push(participant.user_id)
    participantsByConversation.set(participant.conversation_id, rows)
  }

  // Older deployments may not have the inbox RPC. Keep the fallback to a
  // bounded number of round trips too: the old implementation fired two
  // message queries per conversation, which could overwhelm Supabase on a
  // slow/mobile connection. The rows are already ordered newest-first, so
  // latest-message and unread values can be derived in one pass.
  const { data: messageRows, error: messagesErr } = await admin
    .from('messages')
    .select('id, conversation_id, sender_id, content, created_at, attachments')
    .in('conversation_id', conversationIds)
    .gte('created_at', autoDeleteCutoffIso ?? '0001-01-01T00:00:00.000Z')
    .order('created_at', { ascending: false })

  if (messagesErr) throw new Error(messagesErr.message)

  const readAtByConversation = new Map(visibleParticipantRows.map(row => [row.conversation_id, row.last_read_at]))
  const latestByConversation = new Map<string, NonNullable<InboxConversation['last_message']>>()
  const unreadByConversation = new Map<string, number>()
  for (const message of messageRows ?? []) {
    if (!latestByConversation.has(message.conversation_id)) {
      latestByConversation.set(message.conversation_id, {
        id: message.id,
        conversation_id: message.conversation_id,
        sender_id: message.sender_id,
        content: message.content,
        created_at: message.created_at,
        attachments: message.attachments ?? [],
      })
    }
    const readAt = readAtByConversation.get(message.conversation_id)
    if (message.sender_id !== userId && (!readAt || new Date(message.created_at).getTime() > new Date(readAt).getTime())) {
      unreadByConversation.set(message.conversation_id, (unreadByConversation.get(message.conversation_id) ?? 0) + 1)
    }
  }

  let totalUnreadCount = 0
  const enriched = (conversations ?? []).map(conversation => {
    const unreadCount = unreadByConversation.get(conversation.id) ?? 0
    totalUnreadCount += unreadCount
    const otherUserId = (participantsByConversation.get(conversation.id) ?? [])
      .find(participantId => participantId !== userId)

    return {
      id: conversation.id,
      updated_at: conversation.updated_at,
      last_message: latestByConversation.get(conversation.id) ?? null,
      unread_count: unreadCount,
      other_user: otherUserId ? (profileById.get(otherUserId) ?? null) : null,
    }
  })

  return { conversations: enriched, totalUnreadCount }
}

// GET /api/messages — list conversations for current user
//
// Performance note (2026-08-18): this used to loop over every
// conversation and fire two sequential Supabase queries per
// conversation (last message, unread count) — up to 2N+3 round trips
// for a user with N conversations, which stalled the inbox on slower
// connections. Now delegates the entire last-message + unread-count
// computation to a single Postgres RPC (get_message_inbox, see
// supabase/migrations/20260818120000_message_inbox_perf.sql) so the
// whole inbox is one query. Only a follow-up profile lookup for the
// "other participant" avatars/names remains as a second query.
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

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('message_auto_delete_days')
      .eq('id', user.id)
      .maybeSingle()

    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }

    const autoDeleteCutoffIso = getAutoDeleteCutoffIso(profile?.message_auto_delete_days)

    const { data: inboxRows, error: inboxErr } = await admin.rpc('get_message_inbox', {
      p_user_id: user.id,
      p_auto_delete_cutoff: autoDeleteCutoffIso,
    })

    if (inboxErr) {
      console.warn('[GET /api/messages] inbox RPC unavailable; using safe fallback:', inboxErr.message)
      const fallback = await loadInboxFallback(admin, user.id, autoDeleteCutoffIso)
      return NextResponse.json({
        conversations: fallback.conversations,
        total_unread_count: fallback.totalUnreadCount,
      })
    }

    const rows = (inboxRows ?? []) as InboxRow[]

    if (rows.length === 0) {
      return NextResponse.json({ conversations: [], total_unread_count: 0 })
    }

    const otherUserIds = Array.from(new Set(rows
      .map(row => row.other_user_id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)))

    const { data: otherProfiles, error: otherProfilesErr } = otherUserIds.length > 0
      ? await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', otherUserIds)
      : { data: [], error: null }

    if (otherProfilesErr) {
      return NextResponse.json({ error: otherProfilesErr.message }, { status: 500 })
    }

    const profileById = new Map((otherProfiles ?? []).map(profile => [profile.id, profile]))

    let totalUnreadCount = 0
    const enriched = rows.map(row => {
      totalUnreadCount += Number(row.unread_count) || 0
      return {
        id: row.conversation_id,
        updated_at: row.conv_updated_at,
        last_message: row.last_message_id
          ? {
            id: row.last_message_id,
            conversation_id: row.conversation_id,
            sender_id: row.last_message_sender_id,
            content: row.last_message_content,
            created_at: row.last_message_created_at,
            attachments: row.last_message_attachments ?? [],
          }
          : null,
        unread_count: Number(row.unread_count) || 0,
        other_user: row.other_user_id ? (profileById.get(row.other_user_id) ?? null) : null,
      }
    })

    return NextResponse.json({ conversations: enriched, total_unread_count: totalUnreadCount })
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
