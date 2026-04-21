'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Inline message drawer — opens on top of the profile page as a
// slide-in panel so clicking "Message" NEVER leaves the current URL.
// This sidesteps every routing-layer failure mode (middleware
// redirects, stale [id] page redirects on 403, client router weirdness)
// because we never call router.push at all — the conversation lives
// inside the profile page.
//
// Flow when the drawer opens:
//   1. POST /api/conversations with { recipientId } → get conversationId
//      (find-or-create dedup, never creates duplicates).
//   2. GET /api/messages/:id → load history.
//   3. Subscribe to Supabase realtime for new messages.
//   4. POST /api/messages/:id on send.
//
// On close: tears down the realtime channel, resets state.

interface Profile {
  id:         string
  full_name:  string | null
  avatar_url: string | null
}

interface Message {
  id:              string
  conversation_id: string
  sender_id:       string
  content:         string
  created_at:      string
}

export interface MessageDrawerProps {
  open:        boolean
  recipient:   Profile | null
  currentUserId: string | null
  onClose:     () => void
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function MessageDrawer({
  open,
  recipient,
  currentUserId,
  onClose,
}: MessageDrawerProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [input,          setInput]          = useState('')
  const [setupLoading,   setSetupLoading]   = useState(false)
  const [sending,        setSending]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  // Close handler — resets all state + tears down the realtime
  // channel. Uses a ref for the channel so reopens don't leak.
  const close = useCallback(() => {
    if (channelRef.current) {
      const supabase = createClient()
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setConversationId(null)
    setMessages([])
    setInput('')
    setError(null)
    setSetupLoading(false)
    setSending(false)
    onClose()
  }, [onClose])

  // Keyboard: Escape closes the drawer.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // Body scroll lock while the drawer is open — keeps the profile
  // behind it from scrolling when the drawer itself is scrolled.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Setup: when the drawer opens with a recipient, fetch (or create)
  // the conversation and load its message history.
  useEffect(() => {
    if (!open || !recipient || !currentUserId) return
    let cancelled = false

    const setup = async () => {
      setSetupLoading(true)
      setError(null)
      try {
        console.log('[drawer] POST /api/conversations { recipientId:', recipient.id, '}')
        const res = await fetch('/api/conversations', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ recipientId: recipient.id }),
        })
        console.log('[drawer] API status:', res.status)
        const data = await res.json().catch(() => null) as
          | { conversationId?: string; error?: string }
          | null
        console.log('[drawer] API body:', data)

        if (cancelled) return

        if (!res.ok) {
          setError(data?.error || `HTTP ${res.status}`)
          setSetupLoading(false)
          return
        }
        const convId = data?.conversationId
        if (typeof convId !== 'string' || convId.length === 0) {
          setError('No conversation id returned from server')
          setSetupLoading(false)
          return
        }

        setConversationId(convId)

        // Load history
        const histRes = await fetch(`/api/messages/${convId}`, { cache: 'no-store' })
        const hist = await histRes.json().catch(() => null) as
          | { messages?: Message[]; error?: string }
          | null
        if (cancelled) return
        if (!histRes.ok) {
          setError(hist?.error || `Failed to load messages (HTTP ${histRes.status})`)
          setSetupLoading(false)
          return
        }
        setMessages(hist?.messages ?? [])
        setSetupLoading(false)
        setTimeout(() => bottomRef.current?.scrollIntoView(), 80)
        setTimeout(() => inputRef.current?.focus(), 120)

        // Subscribe to realtime INSERTs — only after the thread has
        // a conversation id.
        const supabase = createClient()
        if (channelRef.current) supabase.removeChannel(channelRef.current)
        const channel = supabase
          .channel(`drawer:${convId}`)
          .on(
            'postgres_changes',
            {
              event:  'INSERT',
              schema: 'public',
              table:  'messages',
              filter: `conversation_id=eq.${convId}`,
            },
            payload => {
              const m = payload.new as Message
              setMessages(prev => {
                if (prev.some(x => x.id === m.id)) return prev
                const optIdx = prev.findIndex(
                  x => x.id.startsWith('opt_')
                    && x.sender_id === m.sender_id
                    && x.content === m.content,
                )
                if (optIdx >= 0) {
                  const next = [...prev]
                  next[optIdx] = m
                  return next
                }
                return [...prev, m]
              })
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)
            },
          )
          .subscribe()
        channelRef.current = channel
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[drawer] setup threw:', msg)
        setError(msg)
        setSetupLoading(false)
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (channelRef.current) {
        const supabase = createClient()
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [open, recipient, currentUserId])

  // Auto-scroll on new messages.
  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView()
  }, [messages, open])

  const send = async () => {
    const text = input.trim()
    if (!text || !conversationId || !currentUserId) return
    setInput('')
    // Reset textarea height after clearing
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
    setSending(true)
    setError(null)

    const optimisticId = `opt_${Date.now()}`
    const optimistic: Message = {
      id:              optimisticId,
      conversation_id: conversationId,
      sender_id:       currentUserId,
      content:         text,
      created_at:      new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)

    try {
      const res = await fetch(`/api/messages/${conversationId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text }),
      })
      const data = await res.json().catch(() => null) as
        | { message?: Message; error?: string }
        | null
      if (!res.ok) {
        setError(data?.error || `Failed to send (HTTP ${res.status})`)
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setInput(text)
        return
      }
      if (data?.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message!.id)) {
            return prev.filter(m => m.id !== optimisticId)
          }
          return prev.map(m => (m.id === optimisticId ? data.message! : m))
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setInput(text)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  if (!open) return null

  return (
    <>
      <style>{`
        @keyframes drawer-slide {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes drawer-fade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .drawer-backdrop {
          position: fixed; inset: 0;
          background: rgba(0, 0, 0, 0.55);
          z-index: 10000;
          animation: drawer-fade 0.18s ease-out;
        }
        .drawer-panel {
          position: fixed;
          top: 0; right: 0; bottom: 0;
          width: 100%;
          max-width: 440px;
          background: #0f172a;
          color: #f1f5f9;
          box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          z-index: 10001;
          animation: drawer-slide 0.22s ease-out;
          font-family: system-ui;
          overflow: hidden;
        }
        @media (max-width: 480px) {
          .drawer-panel { max-width: 100%; }
        }
        .drawer-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 1rem;
          border-bottom: 1px solid rgba(56,189,248,0.1);
          background: #111827;
        }
        .drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          -webkit-overflow-scrolling: touch;
        }
         .drawer-input-row {
          flex-shrink: 0;
          display: flex;
          gap: 0.5rem;
          align-items: flex-end;
          padding: 0.75rem;
          padding-bottom: max(0.75rem, env(safe-area-inset-bottom, 0.75rem));
          border-top: 1px solid rgba(56,189,248,0.1);
          background: #111827;
          position: relative;
          z-index: 10001;
        }
        .drawer-textarea {
          flex: 1;
          background: #1e293b;
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 10px;
          color: #f1f5f9;
          -webkit-text-fill-color: #f1f5f9;
          caret-color: #34d399;
          font-family: inherit;
          font-size: 16px; /* prevents iOS auto-zoom */
          padding: 0.6rem 0.85rem;
          resize: none;
          outline: none;
          min-height: 44px;
          max-height: 120px;
        }
        .drawer-textarea:focus {
          border-color: rgba(52,211,153,0.5);
          box-shadow: 0 0 0 3px rgba(52,211,153,0.1);
        }
        .drawer-send {
          width: 44px; height: 44px;
          border: none; border-radius: 10px;
          background: #34d399; color: #0f172a;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .drawer-send:disabled { opacity: 0.4; cursor: not-allowed; }
        .drawer-bubble {
          max-width: 80%;
          padding: 0.55rem 0.85rem;
          border-radius: 14px;
          font-size: 0.88rem;
          line-height: 1.5;
          word-break: break-word;
        }
        .drawer-bubble.sent { background: #34d399; color: #0f172a; border-bottom-right-radius: 4px; }
        .drawer-bubble.recv { background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; border: 1px solid rgba(56,189,248,0.1); }
        .drawer-bubble.pending { opacity: 0.6; }
      `}</style>

      <div className="drawer-backdrop" onClick={close} />

      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Conversation with ${recipient?.full_name || 'member'}`}
      >
        {/* Header */}
        <div className="drawer-header">
          {recipient && (
            <div
              aria-hidden="true"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: 'linear-gradient(135deg,#34d399,#059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: '0.78rem', color: '#0f172a',
                flexShrink: 0,
              }}
            >
              {getInitials(recipient.full_name)}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recipient?.full_name || 'Member'}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {setupLoading ? 'Opening conversation…' : 'Direct message'}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '1.6rem',
              lineHeight: 1,
              width: 36, height: 36,
              borderRadius: 8,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {error && (
            <div
              role="alert"
              style={{
                background:    'rgba(248,113,113,0.08)',
                border:        '1px solid rgba(248,113,113,0.3)',
                borderRadius:  10,
                padding:       '0.75rem 0.9rem',
                marginBottom:  '0.85rem',
                fontSize:      '0.8rem',
                color:         '#fca5a5',
                lineHeight:    1.5,
                wordBreak:     'break-word',
              }}
            >
              <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
                Something went wrong
              </div>
              <div>{error}</div>
            </div>
          )}

          {setupLoading && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0' }}>
              <div
                aria-hidden="true"
                style={{
                  width: 24, height: 24, margin: '0 auto 0.6rem',
                  border: '3px solid rgba(52,211,153,0.2)',
                  borderTopColor: '#34d399',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite',
                }}
              />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              <div style={{ fontSize: '0.82rem' }}>Opening conversation…</div>
            </div>
          )}

          {!setupLoading && messages.length === 0 && !error && (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0', fontSize: '0.85rem' }}>
              No messages yet. Say hello! 👋
            </div>
          )}

          {messages.map((m, i) => {
            const isSent  = m.sender_id === currentUserId
            const isPend  = m.id.startsWith('opt_')
            const prev    = messages[i - 1]
            const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 300_000
            return (
              <div key={m.id}>
                {showTime && (
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#475569', margin: '0.5rem 0' }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start', marginBottom: '0.35rem' }}>
                  <div className={`drawer-bubble ${isSent ? 'sent' : 'recv'}${isPend ? ' pending' : ''}`}>
                    {m.content}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="drawer-input-row">
          <textarea
            ref={inputRef}
            className="drawer-textarea"
            value={input}
            onChange={e => {
                setInput(e.target.value)
                // Auto-resize: expand up to 160px, then scroll
                const el = e.target
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 160) + 'px'
              }}
            onKeyDown={onKeyDown}
            placeholder={conversationId ? 'Type a message…' : 'Opening…'}
            rows={1}
            disabled={!conversationId || setupLoading}
            aria-label="Message input"
          />
          <button
            type="button"
            className="drawer-send"
            onClick={send}
            disabled={!input.trim() || !conversationId || sending || setupLoading}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  )
}
