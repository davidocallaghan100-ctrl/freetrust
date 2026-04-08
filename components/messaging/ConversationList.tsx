
'use client'

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { useConversations } from '@/hooks/useConversations'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { Conversation } from '@/types/messaging'
import styles from './ConversationList.module.css'

interface ConversationListProps {
  activeConversationId?: string
  onSelect?: (id: string) => void
}

export default function ConversationList({
  activeConversationId,
  onSelect,
}: ConversationListProps) {
  const { conversations, loading, error } = useConversations()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null)
    })
  }, [])

  const handleSelect = (id: string) => {
    if (onSelect) {
      onSelect(id)
    } else {
      router.push(`/messages/${id}`)
    }
  }

  const getOtherParticipant = (conv: Conversation) => {
    return conv.participants.find((p) => p.user_id !== currentUserId)
  }

  const getDisplayName = (conv: Conversation) => {
    const other = getOtherParticipant(conv)
    if (!other?.profile) return 'Unknown User'
    return other.profile.full_name || other.profile.username || 'Unknown User'
  }

  const getAvatar = (conv: Conversation) => {
    const other = getOtherParticipant(conv)
    return other?.profile?.avatar_url || null
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className={styles.skeletonItem}>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonContent}>
              <div className={styles.skeletonName} />
              <div className={styles.skeletonMessage} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className={styles.error}>{error}</div>
  }

  if (conversations.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>💬</div>
        <p className={styles.emptyTitle}>No messages yet</p>
        <p className={styles.emptySubtitle}>
          Start a conversation by visiting a member profile or listing
        </p>
      </div>
    )
  }

  return (
    <ul className={styles.list}>
      {conversations.map((conv) => {
        const displayName = getDisplayName(conv)
        const avatar = getAvatar(conv)
        const isActive = conv.id === activeConversationId
        const hasUnread = (conv.unread_count || 0) > 0

        return (
          <li key={conv.id} className={styles.listItem}>
            <button
              className={`${styles.conversationButton} ${isActive ? styles.active : ''} ${hasUnread ? styles.hasUnread : ''}`}
              onClick={() => handleSelect(conv.id)}
            >
              <div className={styles.avatarWrapper}>
                {avatar ? (
                  <img
                    src={avatar}
                    alt={displayName}
                    className={styles.avatar}
                  />
                ) : (
                  <div className={styles.avatarFallback}>
                    {getInitials(displayName)}
                  </div>
                )}
                {hasUnread && <span className={styles.unreadDot} />}
              </div>

              <div className={styles.conversationInfo}>
                <div className={styles.conversationHeader}>
                  <span className={styles.participantName}>{displayName}</span>
                  {conv.last_message && (
                    <span className={styles.timestamp}>
                      {formatDistanceToNow(new Date(conv.last_message.created_at), {
                        addSuffix: false,
                      })}
                    </span>
                  )}
                </div>
                <div className={styles.lastMessage}>
                  {conv.last_message ? (
                    <span
                      className={`${styles.lastMessageText} ${hasUnread ? styles.unreadText : ''}`}
                    >
                      {conv.last_message.sender_id === currentUserId ? 'You: ' : ''}
                      {conv.last_message.content}
                    </span>
                  ) : (
                    <span className={styles.noMessages}>No messages yet</span>
                  )}
                  {hasUnread && (
                    <span className={styles.unreadBadge}>{conv.unread_count}</span>
                  )}
                </div>
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

