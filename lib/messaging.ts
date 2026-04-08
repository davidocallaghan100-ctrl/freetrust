
import { createClient } from '@/lib/supabase/client'
import type { Conversation, Message, NewMessagePayload } from '@/types/messaging'

export async function getOrCreateConversation(
  currentUserId: string,
  recipientId: string
): Promise<string> {
  const supabase = createClient()

  // Check if conversation already exists between these two users
  const { data: existing } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId)

  if (existing && existing.length > 0) {
    const myConversationIds = existing.map((p) => p.conversation_id)

    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', recipientId)
      .in('conversation_id', myConversationIds)

    if (shared && shared.length > 0) {
      // Verify it's a 2-person conversation
      const { data: participantCount } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('conversation_id', shared[0].conversation_id)

      if (participantCount && participantCount.length === 2) {
        return shared[0].conversation_id
      }
    }
  }

  // Create new conversation
  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .insert({})
    .select()
    .single()

  if (convError || !conversation) {
    throw new Error('Failed to create conversation')
  }

  // Add both participants
  const { error: participantError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conversation.id, user_id: currentUserId },
      { conversation_id: conversation.id, user_id: recipientId },
    ])

  if (participantError) {
    throw new Error('Failed to add participants')
  }

  return conversation.id
}

export async function sendMessage(payload: NewMessagePayload): Promise<Message> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) throw new Error('Not authenticated')

  let conversationId = payload.conversationId

  if (!conversationId) {
    conversationId = await getOrCreateConversation(user.id, payload.recipientId)
  }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: payload.content.trim(),
      metadata: payload.contextType
        ? { contextType: payload.contextType, contextId: payload.contextId }
        : {},
    })
    .select()
    .single()

  if (error || !message) {
    throw new Error('Failed to send message')
  }

  return message as Message
}

export async function getConversations(): Promise<Conversation[]> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data: participantRows } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  if (!participantRows || participantRows.length === 0) return []

  const conversationIds = participantRows.map((p) => p.conversation_id)
  const lastReadMap = Object.fromEntries(
    participantRows.map((p) => [p.conversation_id, p.last_read_at])
  )

  const { data: conversations } = await supabase
    .from('conversations')
    .select('*')
    .in('id', conversationIds)
    .order('last_message_at', { ascending: false })

  if (!conversations) return []

  const result: Conversation[] = []

  for (const conv of conversations) {
    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('*, profile:profiles(*)')
      .eq('conversation_id', conv.id)

    const { data: lastMessages } = await supabase
      .from('messages')
      .select('*, sender:profiles(*)')
      .eq('conversation_id', conv.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastRead = lastReadMap[conv.id]
    const { count: unreadCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', conv.id)
      .neq('sender_id', user.id)
      .gt('created_at', lastRead)

    result.push({
      ...conv,
      participants: participants || [],
      last_message: lastMessages?.[0] || null,
      unread_count: unreadCount || 0,
    })
  }

  return result
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = createClient()

  const { data: messages } = await supabase
    .from('messages')
    .select('*, sender:profiles(*)')
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  return (messages as Message[]) || []
}

export async function markConversationAsRead(conversationId: string): Promise<void> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
}

export async function getTotalUnreadCount(): Promise<number> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return 0

  const { data: participantRows } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  if (!participantRows || participantRows.length === 0) return 0

  let total = 0

  for (const row of participantRows) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', row.conversation_id)
      .neq('sender_id', user.id)
      .gt('created_at', row.last_read_at)

    total += count || 0
  }

  return total
}

