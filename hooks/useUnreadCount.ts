
'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTotalUnreadCount } from '@/lib/messaging'

export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const count = await getTotalUnreadCount()
    setUnreadCount(count)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()

    const supabase = createClient()
    let userId: string | null = null

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }

      userId = user.id

      // Subscribe to new messages
      const channel = supabase
        .channel('unread-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=neq.${userId}`,
          },
          () => {
            refresh()
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'conversation_participants',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            refresh()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [refresh])

  return { unreadCount, loading, refresh }
}

