
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// Total unread message count across all of a user's conversations,
// for nav-chrome badges (header message bell, Sidebar/drawer
// "Messages" link).
//
// 2026-08-18 rewrite: previously called lib/messaging.ts's
// getTotalUnreadCount(), which loops over every conversation and does
// ONE sequential Supabase query per conversation to count unread
// messages (N round trips for N conversations, awaited one at a time
// in a for-loop — not even parallelized). Now calls the lightweight
// /api/messages/unread-count route, which is a single Postgres RPC
// call (get_unread_message_count) regardless of conversation count.
export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const userIdRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread-count', { cache: 'no-store' })
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json() as { unread_count?: number }
      setUnreadCount(data.unread_count ?? 0)
    } catch {
      // silently fail — user may not be logged in / offline
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()

    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false)
        return
      }

      userIdRef.current = user.id

      // Subscribe to new messages
      const channel = supabase
        .channel('unread-messages')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `sender_id=neq.${userIdRef.current}`,
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
            filter: `user_id=eq.${userIdRef.current}`,
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

  // Optimistic client-side decrement — fired by app/messages/page.tsx
  // the instant a conversation is opened, so the nav badge updates
  // immediately instead of waiting on the last_read_at UPDATE to
  // round-trip through Postgres realtime. The realtime subscription
  // above still fires afterwards and reconciles against the server,
  // so this is safe even if the write fails (worst case: a brief
  // undercount until the next refresh).
  useEffect(() => {
    const onOptimisticRead = (event: Event) => {
      const detail = (event as CustomEvent<{ amount?: number }>).detail
      const amount = typeof detail?.amount === 'number' ? detail.amount : 0
      if (amount <= 0) return
      setUnreadCount(prev => Math.max(0, prev - amount))
    }
    window.addEventListener('freetrust:messages-read', onOptimisticRead)
    return () => window.removeEventListener('freetrust:messages-read', onOptimisticRead)
  }, [])

  return { unreadCount, loading, refresh }
}
