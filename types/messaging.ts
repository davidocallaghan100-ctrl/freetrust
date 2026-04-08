
export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  last_seen_at: string | null
}

export interface ConversationParticipant {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
  profile: Profile
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string
  is_deleted: boolean
  metadata: Record<string, unknown>
  sender?: Profile
}

export interface Conversation {
  id: string
  created_at: string
  updated_at: string
  last_message_at: string
  participants: ConversationParticipant[]
  last_message?: Message | null
  unread_count?: number
}

export interface NewMessagePayload {
  recipientId: string
  content: string
  conversationId?: string
  contextType?: 'listing' | 'profile' | 'direct'
  contextId?: string
}

