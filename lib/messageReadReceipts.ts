import type { SupabaseClient } from '@supabase/supabase-js'

export interface MessageReadReceipt {
  user_id: string
  read_at: string
}

export interface ReadableMessage {
  id: string
  sender_id: string
  read_receipts?: MessageReadReceipt[] | null
}

export function isMessageReadByAllOthers(
  message: ReadableMessage,
  currentUserId: string | null,
  participantIds: string[],
): boolean {
  if (!currentUserId || message.sender_id !== currentUserId) return false
  const requiredReaderIds = participantIds.filter(id => id && id !== currentUserId)
  if (requiredReaderIds.length === 0) return false

  const readers = new Set(
    (message.read_receipts ?? [])
      .filter(receipt => !!receipt.read_at)
      .map(receipt => receipt.user_id),
  )

  return requiredReaderIds.every(id => readers.has(id))
}

export async function markMessagesRead(
  supabase: SupabaseClient,
  messageIds: string[],
  userId: string,
): Promise<void> {
  const uniqueIds = Array.from(new Set(messageIds.filter(Boolean)))
  if (uniqueIds.length === 0) return

  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('message_reads')
    .upsert(
      uniqueIds.map(message_id => ({ message_id, user_id: userId, read_at: nowIso })),
      { onConflict: 'message_id,user_id' },
    )

  if (error) {
    throw new Error(error.message)
  }
}

export function applyReadReceipt<T extends ReadableMessage>(
  messages: T[],
  receipt: { message_id?: unknown; user_id?: unknown; read_at?: unknown },
): T[] {
  if (typeof receipt.message_id !== 'string' || typeof receipt.user_id !== 'string') return messages
  const readAt = typeof receipt.read_at === 'string' ? receipt.read_at : new Date().toISOString()

  return messages.map(message => {
    if (message.id !== receipt.message_id) return message
    const existing = message.read_receipts ?? []
    const nextReceipts = existing.some(item => item.user_id === receipt.user_id)
      ? existing.map(item => item.user_id === receipt.user_id ? { ...item, read_at: readAt } : item)
      : [...existing, { user_id: receipt.user_id, read_at: readAt }]
    return { ...message, read_receipts: nextReceipts }
  })
}
