'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RealtimeChannel } from '@supabase/supabase-js'
import MessageAttachments from '@/components/messaging/MessageAttachments'
import {
  formatAttachmentSize,
  uploadMessageAttachments,
  validateMessageAttachmentFiles,
  type MessageAttachment,
} from '@/lib/messageAttachments'
import {
  applyReadReceipt,
  isMessageReadByAllOthers,
  markMessagesRead,
  type MessageReadReceipt,
} from '@/lib/messageReadReceipts'

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
  attachments?:    MessageAttachment[]
  reply_to_id?:     string | null
  read_receipts?:   MessageReadReceipt[]
  sender?:         Profile
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

const GRADIENTS = [
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
]

function pickGradient(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

export default function ConversationPage() {
  const params         = useParams()
  const router         = useRouter()
  const conversationId = params.id as string

  const [userId,    setUserId]    = useState<string | null>(null)
  const [messages,  setMessages]  = useState<Message[]>([])
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [input,     setInput]     = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [sending,   setSending]   = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [sendError, setSendError] = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const markedReadRef = useRef<Set<string>>(new Set())
  const channelRef = useRef<RealtimeChannel | null>(null)

  const [loadError, setLoadError] = useState<string | null>(null)

  // Fetch full message history via the GET /api/messages/:id route.
  // The route is wrapped in a participant check and also bumps
  // last_read_at, so calling it from here doubles as a "mark as
  // read" signal without needing a separate endpoint.
  //
  // IMPORTANT: do NOT router.push('/messages') on 403 — that was
  // the bug where clicking "Message" on a profile appeared to go
  // straight to the inbox. The brief visit to /messages/[id]
  // bounced away before the page even painted. Instead, surface
  // the error inline so the user (and the bug reporter) can see
  // the real reason.
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/messages/${conversationId}`, { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string }
        console.error('[messages/:id] load failed:', res.status, err)
        setLoadError(err.error || `HTTP ${res.status}`)
        return
      }
      setLoadError(null)
      const data = await res.json() as { messages: Message[]; participant_ids?: string[] }
      setMessages(data.messages ?? [])
      setParticipantIds(Array.isArray(data.participant_ids) ? data.participant_ids : [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[messages/:id] load threw:', msg)
      setLoadError(msg)
    }
  }, [conversationId, router])

  // Fetch the other participant's profile. Relies on the new RLS
  // policies from 20260415000009_messaging_rls.sql — before that
  // migration the self-referential participants_select policy
  // caused an infinite-recursion error and this query returned
  // nothing, leaving the header blank.
  const loadOtherUser = useCallback(async (myId: string) => {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('user_id, profile:profiles(id, full_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .neq('user_id', myId)
        .limit(1)
      if (error) {
        console.error('[messages/:id] other user fetch failed:', error)
        return
      }
      if (data && data[0]) {
        const p0 = data[0] as unknown as { profile: Profile | Profile[] | null }
        const rawProfile = Array.isArray(p0.profile) ? p0.profile[0] : p0.profile
        if (rawProfile) setOtherUser(rawProfile)
      }
    } catch (err) {
      console.error('[messages/:id] other user threw:', err)
    }
  }, [conversationId])

  // Subscribe (or re-subscribe) to realtime INSERTs for this
  // conversation. Stored in a ref so visibilitychange / pageshow
  // handlers below can rebuild the channel without tearing down
  // the whole effect.
  const subscribeRealtime = useCallback(() => {
    const supabase = createClient()

    // Clean up any prior channel — otherwise mobile backgrounding
    // would leak a channel on every foreground.
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`conv:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        payload => {
          const m = payload.new as Message
          setMessages(prev => {
            // De-dupe against optimistic bubbles (opt_*) and any
            // realtime duplicate (e.g. if both loadMessages and
            // the subscription fire for the same id).
            if (prev.some(x => x.id === m.id)) return prev
            // Swap an optimistic bubble for the real one if the
            // content matches — avoids visible double-send.
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
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reads',
        },
        payload => {
          setMessages(prev => applyReadReceipt(prev, payload.new as Record<string, unknown>))
        },
      )
      .subscribe()

    channelRef.current = channel
  }, [conversationId])

  // Initial auth + data load + subscription.
  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    setLoading(true)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      await Promise.all([loadMessages(), loadOtherUser(user.id)])
      subscribeRealtime()
      setLoading(false)
      setTimeout(() => bottomRef.current?.scrollIntoView(), 100)
    })
    return () => {
      cancelled = true
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [conversationId, router, loadMessages, loadOtherUser, subscribeRealtime])

  // Realtime reconnect on tab foreground / BFCache restore.
  //
  // Mobile networks drop WebSocket connections aggressively:
  // backgrounding, Wi-Fi handover, screen lock, and iOS Safari's
  // back/forward cache all kill the channel. Without an explicit
  // resubscribe, a user who left the chat open and came back would
  // miss every message that arrived in the meantime.
  //
  // We rebuild the channel AND refetch history on visibility change
  // — the refetch closes the gap for any INSERT that happened while
  // the channel was dead, and the resubscribe catches anything that
  // lands after this point.
  useEffect(() => {
    if (!conversationId) return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void loadMessages()
        subscribeRealtime()
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        void loadMessages()
        subscribeRealtime()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pageshow', onPageShow)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [conversationId, loadMessages, subscribeRealtime])

  // Send via POST /api/messages/[conversationId] — the route is
  // transactional: it inserts the message, updates the conversation
  // timestamp so it sorts to the top of the list, and touches the
  // sender's last_read_at. Doing all three in a single API call
  // avoids the "ledger drift" bug class where the message lands
  // but the conversation sort order never updates.
  const send = async () => {
    const text = input.trim()
    if ((!text && attachedFiles.length === 0) || !userId) return
    setInput('')
    const filesToSend = attachedFiles
    setAttachedFiles([])
    const replyTarget = replyingTo
    setReplyingTo(null)
    setSending(true)
    setSendError(null)

    const optimisticId = `opt_${Date.now()}`
    const optimistic: Message = {
      id:              optimisticId,
      conversation_id: conversationId,
      sender_id:       userId,
      content:         text,
      created_at:      new Date().toISOString(),
      attachments:     filesToSend.map(file => ({ url: '', type: file.type, name: file.name, size: file.size })),
      reply_to_id:     replyTarget?.id ?? null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const uploadedAttachments = filesToSend.length > 0
        ? await uploadMessageAttachments(createClient(), filesToSend, { userId, conversationId })
        : []
      const res = await fetch(`/api/messages/${conversationId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content: text, attachments: uploadedAttachments, replyToId: replyTarget?.id ?? null }),
      })
      const data = await res.json().catch(() => null) as
        | { message?: Message; error?: string }
        | null
      if (!res.ok) {
        console.error('[messages/:id] send failed:', data)
        setSendError(data?.error || 'Message failed to send')
        // Drop the optimistic bubble so the user retypes rather
        // than being left with an orange-ghost bubble that never
        // made it to the server. The input is re-populated so
        // they don't lose what they typed.
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setInput(text)
        setAttachedFiles(filesToSend)
        setReplyingTo(replyTarget)
        return
      }
      // Success: swap the optimistic bubble for the real one if
      // the realtime subscription hasn't already done it.
      if (data?.message) {
        setMessages(prev => {
          const alreadyReal = prev.some(m => m.id === data.message!.id)
          if (alreadyReal) return prev.filter(m => m.id !== optimisticId)
          return prev.map(m => (m.id === optimisticId ? data.message! : m))
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[messages/:id] send threw:', msg)
      setSendError(msg)
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setInput(text)
      setAttachedFiles(filesToSend)
      setReplyingTo(replyTarget)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const onPickFiles = (files: FileList | null) => {
    if (!files) return
    const nextFiles = Array.from(files)
    const error = validateMessageAttachmentFiles(nextFiles, attachedFiles.length)
    if (error) {
      setSendError(error)
    } else {
      setSendError(null)
      setAttachedFiles(prev => [...prev, ...nextFiles])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const messagesById = new Map(messages.map(message => [message.id, message]))

  const scrollToMessage = (id: string) => {
    const target = messageRefs.current.get(id)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('conv-message-highlight')
    window.setTimeout(() => target.classList.remove('conv-message-highlight'), 1200)
  }

  useEffect(() => {
    if (!userId || messages.length === 0) return
    const unreadIncoming = messages.filter(message =>
      !message.id.startsWith('opt_')
      && message.sender_id !== userId
      && !markedReadRef.current.has(message.id),
    )
    if (unreadIncoming.length === 0) return

    const observer = new IntersectionObserver(entries => {
      const visibleIds = entries
        .filter(entry => entry.isIntersecting)
        .map(entry => (entry.target as HTMLElement).dataset.messageId)
        .filter((id): id is string => !!id && !markedReadRef.current.has(id))
      if (visibleIds.length === 0) return
      visibleIds.forEach(id => markedReadRef.current.add(id))
      void markMessagesRead(createClient(), visibleIds, userId).catch(err => {
        console.error('[messages/:id] mark read failed:', err)
        visibleIds.forEach(id => markedReadRef.current.delete(id))
      })
    }, { threshold: 0.6 })

    unreadIncoming.forEach(message => {
      const element = messageRefs.current.get(message.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [messages, userId])

  // Auto-scroll to bottom whenever the message list changes.
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [messages])

  return (
    <div className="conv-root">
      <style>{`
        /* Dynamic viewport units so iOS Safari's collapsing URL bar
           and the Android soft keyboard don't push the input off
           screen. 100vh is kept as a fallback for older browsers. */
        .conv-root {
          height: calc(100vh - 58px);
          height: calc(100dvh - 58px);
          background: #0f172a;
          color: #f1f5f9;
          font-family: system-ui;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .conv-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          -webkit-overflow-scrolling: touch;
        }
        .conv-bubble {
          max-width: 72%;
          padding: 0.6rem 0.9rem;
          border-radius: 14px;
          font-size: 0.88rem;
          line-height: 1.5;
          word-break: break-word;
        }
        .conv-bubble.sent { background: #38bdf8; color: #0f172a; border-bottom-right-radius: 4px; }
        .conv-bubble.recv { background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; border: 1px solid rgba(56,189,248,0.1); }
        .conv-bubble.pending { opacity: 0.6; }
        .conv-message-highlight .conv-bubble { box-shadow: 0 0 0 3px rgba(251,191,36,0.55); }
        .conv-reply-action {
          align-self: center;
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          font-size: 0.72rem;
          padding: 0.25rem 0.4rem;
        }
        .conv-reply-action:hover { color: #38bdf8; }
        .conv-quote {
          border-left: 3px solid rgba(56,189,248,0.55);
          border-radius: 8px;
          padding: 0.38rem 0.55rem;
          margin-bottom: 0.45rem;
          background: rgba(15,23,42,0.18);
          color: inherit;
          width: 100%;
          text-align: left;
          cursor: pointer;
          font: inherit;
        }
        .conv-quote-label { display: block; font-size: 0.68rem; font-weight: 800; opacity: 0.75; margin-bottom: 0.12rem; }
        .conv-quote-text { display: block; font-size: 0.78rem; opacity: 0.86; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .conv-reply-preview {
          margin: 0.7rem 1rem 0;
          border: 1px solid rgba(56,189,248,0.2);
          border-radius: 12px;
          background: rgba(30,41,59,0.92);
          padding: 0.58rem 0.7rem;
          display: flex;
          gap: 0.7rem;
          align-items: center;
        }
        .conv-reply-preview-main { flex: 1; min-width: 0; }
        .conv-reply-cancel { border: none; background: transparent; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }

        .conv-header {
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid rgba(56,189,248,0.1);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: #111827;
          flex-shrink: 0;
        }

        .conv-input-area {
          padding: 0.85rem 1rem;
          border-top: 1px solid rgba(56,189,248,0.1);
          display: flex;
          gap: 0.65rem;
          align-items: flex-end;
          background: #111827;
          flex-shrink: 0;
        }
        .conv-input-stack {
          border-top: 1px solid rgba(56,189,248,0.1);
          background: #111827;
          flex-shrink: 0;
        }
        .conv-attachment-preview-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          padding: 0.7rem 1rem 0;
        }
        .conv-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          max-width: 100%;
          border: 1px solid rgba(56,189,248,0.18);
          border-radius: 999px;
          background: rgba(30,41,59,0.92);
          color: #cbd5e1;
          padding: 0.35rem 0.5rem 0.35rem 0.65rem;
          font-size: 0.72rem;
        }
        .conv-attachment-remove {
          border: none;
          border-radius: 999px;
          background: rgba(248,113,113,0.15);
          color: #fca5a5;
          width: 22px;
          height: 22px;
          cursor: pointer;
        }
        .conv-attach-btn {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          border: 1px solid rgba(56,189,248,0.18);
          background: #1e293b;
          color: #38bdf8;
          font-size: 1.4rem;
          cursor: pointer;
          flex-shrink: 0;
        }

        /* BottomNav is position:fixed, 64 px tall, only on mobile
           (below 768 px). Reserve space for it PLUS the iOS home
           indicator safe area so the send button and last message
           aren't hidden behind the nav. */
        @media (max-width: 768px) {
          .conv-input-area {
            padding-bottom: calc(0.85rem + 64px + env(safe-area-inset-bottom, 0px));
          }
        }

        .conv-textarea {
          flex: 1;
          background: #1e293b;
          border: 1px solid rgba(56,189,248,0.15);
          border-radius: 10px;
          color: #f1f5f9;
          font-family: inherit;
          font-size: 16px;           /* 16px prevents iOS Safari auto-zoom on focus */
          padding: 0.65rem 0.9rem;
          resize: none;
          outline: none;
          max-height: 120px;
          overflow-y: auto;
        }
        .conv-textarea:focus { border-color: rgba(56,189,248,0.35); }

        .conv-send-btn {
          background: #38bdf8;
          border: none;
          border-radius: 10px;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .conv-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .conv-err-banner {
          margin: 0 1rem 0.5rem;
          background: rgba(248,113,113,0.08);
          border: 1px solid rgba(248,113,113,0.3);
          border-radius: 10px;
          padding: 0.55rem 0.8rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.78rem;
          color: #fca5a5;
          flex-shrink: 0;
        }
      `}</style>

      {/* Header */}
      <div className="conv-header">
        <Link
          href="/messages"
          aria-label="Back to conversations"
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '1.4rem',
            textDecoration: 'none',
            lineHeight: 1,
            padding: '0.25rem 0.5rem',
            minHeight: 44,
            minWidth: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ←
        </Link>
        {otherUser ? (
          <>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: pickGradient(otherUser.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
              {getInitials(otherUser.full_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {otherUser.full_name || 'Member'}
              </div>
            </div>
            <Link
              href={`/profile?id=${otherUser.id}`}
              style={{
                background: 'rgba(56,189,248,0.08)',
                border: '1px solid rgba(56,189,248,0.2)',
                borderRadius: 7,
                padding: '0.4rem 0.8rem',
                fontSize: '0.78rem',
                color: '#38bdf8',
                textDecoration: 'none',
                minHeight: 36,
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Profile
            </Link>
          </>
        ) : (
          <div style={{ flex: 1, color: '#64748b', fontSize: '0.85rem' }}>
            {loading ? 'Loading…' : 'Member'}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="conv-messages">
        {loadError && (
          <div
            role="alert"
            style={{
              background:    'rgba(248,113,113,0.08)',
              border:        '1px solid rgba(248,113,113,0.3)',
              borderRadius:  10,
              padding:       '0.85rem 1rem',
              marginBottom:  '1rem',
              fontSize:      '0.82rem',
              color:         '#fca5a5',
              lineHeight:    1.5,
            }}
          >
            <div style={{ fontWeight: 700, color: '#f87171', marginBottom: 4 }}>
              Couldn&apos;t load this conversation
            </div>
            <div style={{ wordBreak: 'break-word' }}>{loadError}</div>
            <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#94a3b8' }}>
              Conversation id: <code style={{ color: '#cbd5e1' }}>{conversationId}</code>
            </div>
          </div>
        )}
        {messages.length === 0 && !loading && !loadError && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.85rem', marginTop: '2rem' }}>
            No messages yet. Say hello! 👋
          </div>
        )}
        {messages.map((msg, i) => {
          const isSent  = msg.sender_id === userId
          const prev    = messages[i - 1]
          const showTime = !prev || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 300_000
          const isPending = msg.id.startsWith('opt_')
          return (
            <div key={msg.id}>
              {showTime && (
                <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#475569', margin: '0.75rem 0' }}>
                  {new Date(msg.created_at).toLocaleString()}
                </div>
              )}
              <div
                ref={el => {
                  if (el) messageRefs.current.set(msg.id, el)
                  else messageRefs.current.delete(msg.id)
                }}
                data-message-id={msg.id}
                style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start', marginBottom: '0.3rem', gap: '0.25rem' }}
              >
                {!isSent && otherUser && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: pickGradient(otherUser.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a', flexShrink: 0, marginRight: '0.4rem', alignSelf: 'flex-end' }}>
                    {getInitials(otherUser.full_name)}
                  </div>
                )}
                <div className={`conv-bubble ${isSent ? 'sent' : 'recv'}${isPending ? ' pending' : ''}`}>
                  {msg.reply_to_id && (() => {
                    const replied = messagesById.get(msg.reply_to_id)
                    return (
                      <button type="button" className="conv-quote" onClick={() => scrollToMessage(msg.reply_to_id!)}>
                        <span className="conv-quote-label">Replying to {replied?.sender_id === userId ? 'you' : 'member'}</span>
                        <span className="conv-quote-text">{replied?.content || (replied?.attachments?.length ? 'Attachment' : 'Original message')}</span>
                      </button>
                    )
                  })()}
                  {msg.content && <div>{msg.content}</div>}
                  <MessageAttachments attachments={msg.attachments ?? []} compact />
                  {isSent && !isPending && (
                    <div style={{ marginTop: 4, fontSize: '0.68rem', textAlign: 'right', opacity: 0.72 }}>
                      {isMessageReadByAllOthers(msg, userId, participantIds) ? '✓✓' : '✓'}
                    </div>
                  )}
                </div>
                <button type="button" className="conv-reply-action" onClick={() => { setReplyingTo(msg); inputRef.current?.focus() }} aria-label="Reply to message">
                  Reply
                </button>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Inline send-error banner — stays visible until the next
          successful send or the user dismisses it by retyping. */}
      {sendError && (
        <div className="conv-err-banner" role="alert">
          <span aria-hidden="true">⚠️</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#f87171' }}>Message failed to send</div>
            <div style={{ wordBreak: 'break-word' }}>{sendError}</div>
          </div>
          <button
            type="button"
            onClick={() => setSendError(null)}
            aria-label="Dismiss error"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fca5a5',
              fontSize: '1.1rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              minHeight: 32,
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Input */}
      <div className="conv-input-stack">
        {replyingTo && (
          <div className="conv-reply-preview" role="status">
            <div className="conv-reply-preview-main">
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#38bdf8' }}>Replying to {replyingTo.sender_id === userId ? 'your message' : (otherUser?.full_name || 'member')}</div>
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {replyingTo.content || (replyingTo.attachments?.length ? 'Attachment' : 'Message')}
              </div>
            </div>
            <button type="button" className="conv-reply-cancel" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button>
          </div>
        )}
        {attachedFiles.length > 0 && (
          <div className="conv-attachment-preview-row" aria-label="Selected attachments">
            {attachedFiles.map((file, index) => (
              <span className="conv-attachment-chip" key={`${file.name}-${file.lastModified}-${index}`}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                <span style={{ opacity: 0.68 }}>{formatAttachmentSize(file.size)}</span>
                <button
                  type="button"
                  className="conv-attachment-remove"
                  onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                  aria-label={`Remove ${file.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="conv-input-area">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
          onChange={e => onPickFiles(e.target.files)}
        />
        <button
          type="button"
          className="conv-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
          aria-label="Attach files"
          title="Attach image or file"
        >
          +
        </button>
        <textarea
          ref={inputRef}
          className="conv-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          rows={1}
          aria-label="Message input"
        />
        <button
          className="conv-send-btn"
          onClick={send}
          disabled={(!input.trim() && attachedFiles.length === 0) || sending}
          aria-label="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
        </div>
      </div>
    </div>
  )
}
