'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Conversation } from '@/types/messaging'
import styles from './MessageThread.module.css'

interface MessageThreadProps {
  conversation: Conversation
  currentUserId: string
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: { id: string; full_name: string | null; avatar_url: string | null }
}

export default function MessageThread({ conversation, currentUserId }: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('messages')
      .select('*, sender:profiles(id, full_name, avatar_url)')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as Message[])
        bottomRef.current?.scrollIntoView()
      })

    const channel = supabase
      .channel(`messages:${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversation.id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message])
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversation.id])

  const handleSend = async () => {
    if (!input.trim() || sending) return
    setSending(true)
    const supabase = createClient()
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: currentUserId,
      content: input.trim(),
    })
    setInput('')
    setSending(false)
  }

  return (
    <div className={styles.thread}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>No messages yet. Say hello!</div>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`${styles.bubble} ${isOwn ? styles.own : styles.other}`}>
              {!isOwn && (
                <span className={styles.senderName}>
                  {msg.sender?.full_name ?? 'Member'}
                </span>
              )}
              <p>{msg.content}</p>
              <span className={styles.time}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      <div className={styles.inputRow}>
        <input
          className="form-input"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          disabled={sending}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={sending || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  )
}
