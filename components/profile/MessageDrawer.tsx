'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import MessageAttachments from '@/components/messaging/MessageAttachments'
import GifPicker from '@/components/gifs/GifPicker'
import GifContent from '@/components/gifs/GifContent'
import { appendGifMarker, decodeGifMarker, gifPreviewLabel, stripGifMarkers, type GifResult } from '@/lib/gifs'
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
  attachments?:    MessageAttachment[]
  reply_to_id?:     string | null
  read_receipts?:   MessageReadReceipt[]
  sender?:          Profile
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

function cssUrl(url: string): string {
  return `url("${url.replace(/"/g, '\\"')}")`
}

function AvatarCircle({
  profile,
  size = 38,
  fontSize = '0.78rem',
}: {
  profile?: Pick<Profile, 'avatar_url' | 'full_name' | 'id'> | null
  size?: number
  fontSize?: string
}) {
  const avatarUrl = profile?.avatar_url || null
  const label = profile?.full_name || 'Member'
  return (
    <div
      aria-label={label}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatarUrl ? 'var(--ft-bg)' : 'linear-gradient(135deg,#34d399,#059669)',
        backgroundImage: avatarUrl ? cssUrl(avatarUrl) : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 800,
        fontSize,
        color: 'var(--ft-bg)',
        flexShrink: 0,
      }}
    >
      {!avatarUrl ? getInitials(label) : null}
    </div>
  )
}

function isGifOnlyMessage(content: string | null | undefined): boolean {
  return !!decodeGifMarker(content) && stripGifMarkers(content).length === 0
}

export default function MessageDrawer({
  open,
  recipient,
  currentUserId,
  onClose,
}: MessageDrawerProps) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages,       setMessages]       = useState<Message[]>([])
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [input,          setInput]          = useState('')
  const [selectedGif,    setSelectedGif]    = useState<GifResult | null>(null)
  const [attachedFiles,  setAttachedFiles]  = useState<File[]>([])
  const [replyingTo,     setReplyingTo]     = useState<Message | null>(null)
  const [setupLoading,   setSetupLoading]   = useState(false)
  const [sending,        setSending]        = useState(false)
  const [error,          setError]          = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const markedReadRef = useRef<Set<string>>(new Set())
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
    setParticipantIds([])
    setInput('')
    setSelectedGif(null)
    setAttachedFiles([])
    setReplyingTo(null)
    markedReadRef.current.clear()
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
          | { messages?: Message[]; participant_ids?: string[]; error?: string }
          | null
        if (cancelled) return
        if (!histRes.ok) {
          setError(hist?.error || `Failed to load messages (HTTP ${histRes.status})`)
          setSetupLoading(false)
          return
        }
        setMessages(hist?.messages ?? [])
        setParticipantIds(Array.isArray(hist?.participant_ids) ? hist.participant_ids : [])
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
          .on(
            'postgres_changes',
            {
              event:  '*',
              schema: 'public',
              table:  'message_reads',
            },
            payload => {
              setMessages(prev => applyReadReceipt(prev, payload.new as Record<string, unknown>))
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
    if ((!text && attachedFiles.length === 0 && !selectedGif) || !conversationId || !currentUserId) return
    const gifToSend = selectedGif
    const content = appendGifMarker(text, gifToSend)
    setInput('')
    setSelectedGif(null)
    const filesToSend = attachedFiles
    setAttachedFiles([])
    const replyTarget = replyingTo
    setReplyingTo(null)
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
      content,
      created_at:      new Date().toISOString(),
      attachments:     filesToSend.map(file => ({ url: '', type: file.type, name: file.name, size: file.size })),
      reply_to_id:     replyTarget?.id ?? null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40)

    try {
      const uploadedAttachments = filesToSend.length > 0
        ? await uploadMessageAttachments(createClient(), filesToSend, { userId: currentUserId, conversationId })
        : []
      const res = await fetch(`/api/messages/${conversationId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content, attachments: uploadedAttachments, replyToId: replyTarget?.id ?? null }),
      })
      const data = await res.json().catch(() => null) as
        | { message?: Message; error?: string }
        | null
      if (!res.ok) {
        setError(data?.error || `Failed to send (HTTP ${res.status})`)
        setMessages(prev => prev.filter(m => m.id !== optimisticId))
        setInput(text)
        setSelectedGif(gifToSend)
        setAttachedFiles(filesToSend)
        setReplyingTo(replyTarget)
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
      setSelectedGif(gifToSend)
      setAttachedFiles(filesToSend)
      setReplyingTo(replyTarget)
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

  const onPickFiles = (files: FileList | null) => {
    if (!files) return
    const nextFiles = Array.from(files)
    const validationError = validateMessageAttachmentFiles(nextFiles, attachedFiles.length)
    if (validationError) {
      setError(validationError)
    } else {
      setError(null)
      setAttachedFiles(prev => [...prev, ...nextFiles])
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const messagesById = new Map(messages.map(message => [message.id, message]))

  const scrollToMessage = (id: string) => {
    const target = messageRefs.current.get(id)
    if (!target) return
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    target.classList.add('drawer-message-highlight')
    window.setTimeout(() => target.classList.remove('drawer-message-highlight'), 1200)
  }

  useEffect(() => {
    if (!open || !currentUserId || messages.length === 0) return
    const unreadIncoming = messages.filter(message =>
      !message.id.startsWith('opt_')
      && message.sender_id !== currentUserId
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
      void markMessagesRead(createClient(), visibleIds, currentUserId).catch(err => {
        console.error('[drawer] mark read failed:', err)
        visibleIds.forEach(id => markedReadRef.current.delete(id))
      })
    }, { threshold: 0.6 })

    unreadIncoming.forEach(message => {
      const element = messageRefs.current.get(message.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [messages, currentUserId, open])

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
          background: var(--ft-bg);
          color: var(--ft-text);
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
        .drawer-input-stack {
          flex-shrink: 0;
          border-top: 1px solid rgba(56,189,248,0.1);
          background: #111827;
          position: relative;
          z-index: 10001;
        }
        .drawer-attachment-preview-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          padding: 0.65rem 0.75rem 0;
        }
        .drawer-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          max-width: 100%;
          border: 1px solid rgba(52,211,153,0.2);
          border-radius: 999px;
          background: rgba(30,41,59,0.92);
          color: var(--ft-text-secondary);
          padding: 0.32rem 0.45rem 0.32rem 0.6rem;
          font-size: 0.7rem;
        }
        .drawer-attachment-remove {
          border: none;
          border-radius: 999px;
          background: rgba(248,113,113,0.15);
          color: #fca5a5;
          width: 22px;
          height: 22px;
          cursor: pointer;
        }
        .drawer-attach {
          width: 44px; height: 44px;
          border: 1px solid rgba(52,211,153,0.22);
          border-radius: 10px;
          background: var(--ft-surface);
          color: #34d399;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          font-size: 1.35rem;
        }
        .drawer-textarea {
          flex: 1;
          background: var(--ft-surface);
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 10px;
          color: var(--ft-text);
          -webkit-text-fill-color: var(--ft-text);
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
          background: #34d399; color: var(--ft-bg);
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
        .drawer-bubble.sent { background: #34d399; color: var(--ft-bg); border-bottom-right-radius: 4px; }
        .drawer-bubble.recv { background: var(--ft-surface); color: #e2e8f0; border-bottom-left-radius: 4px; border: 1px solid rgba(56,189,248,0.1); }
        .drawer-bubble.gif-only { padding: 0; background: transparent; border: none; max-width: min(80%, 250px); }
        .drawer-bubble.pending { opacity: 0.6; }
        .drawer-message-highlight .drawer-bubble { box-shadow: 0 0 0 3px rgba(251,191,36,0.55); }
        .drawer-reply-action { align-self: center; border: none; background: transparent; color: var(--ft-text-tertiary); cursor: pointer; font-size: 0.7rem; padding: 0.2rem 0.35rem; }
        .drawer-reply-action:hover { color: #34d399; }
        .drawer-quote { border-left: 3px solid rgba(52,211,153,0.62); border-radius: 8px; padding: 0.35rem 0.5rem; margin-bottom: 0.42rem; background: rgba(15,23,42,0.18); color: inherit; width: 100%; text-align: left; cursor: pointer; font: inherit; }
        .drawer-quote-label { display: block; font-size: 0.66rem; font-weight: 800; opacity: 0.75; margin-bottom: 0.1rem; }
        .drawer-quote-text { display: block; font-size: 0.76rem; opacity: 0.86; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .drawer-reply-preview { margin: 0.65rem 0.75rem 0; border: 1px solid rgba(52,211,153,0.22); border-radius: 12px; background: rgba(30,41,59,0.92); padding: 0.55rem 0.65rem; display: flex; gap: 0.65rem; align-items: center; }
        .drawer-reply-preview-main { flex: 1; min-width: 0; }
        .drawer-reply-cancel { border: none; background: transparent; color: var(--ft-text-secondary); font-size: 1.15rem; cursor: pointer; }
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
            <AvatarCircle profile={recipient} size={38} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {recipient?.full_name || 'Member'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ft-text-tertiary)' }}>
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
              color: 'var(--ft-text-secondary)',
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
              <div style={{ fontWeight: 700, color: 'var(--ft-danger)', marginBottom: 4 }}>
                Something went wrong
              </div>
              <div>{error}</div>
            </div>
          )}

          {setupLoading && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--ft-text-tertiary)', padding: '1.5rem 0' }}>
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
            <div style={{ textAlign: 'center', color: 'var(--ft-text-tertiary)', padding: '1.5rem 0', fontSize: '0.85rem' }}>
              No messages yet. Say hello! 👋
            </div>
          )}

          {messages.map((m, i) => {
            const isSent  = m.sender_id === currentUserId
            const isPend  = m.id.startsWith('opt_')
            const prev    = messages[i - 1]
            const gifOnly = isGifOnlyMessage(m.content)
            const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 300_000
            return (
              <div key={m.id}>
                {showTime && (
                  <div style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--ft-text-faint)', margin: '0.5rem 0' }}>
                    {new Date(m.created_at).toLocaleString()}
                  </div>
                )}
                <div
                  ref={el => {
                    if (el) messageRefs.current.set(m.id, el)
                    else messageRefs.current.delete(m.id)
                  }}
                  data-message-id={m.id}
                  style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start', marginBottom: '0.35rem', gap: '0.25rem' }}
                >
                  {!isSent && (
                    <div style={{ marginRight: '0.35rem', alignSelf: 'flex-end' }}>
                      <AvatarCircle profile={m.sender ?? recipient} size={26} fontSize="0.6rem" />
                    </div>
                  )}
                  <div className={`drawer-bubble ${isSent ? 'sent' : 'recv'}${gifOnly ? ' gif-only' : ''}${isPend ? ' pending' : ''}`}>
                    {m.reply_to_id && (() => {
                      const replied = messagesById.get(m.reply_to_id)
                      return (
                        <button type="button" className="drawer-quote" onClick={() => scrollToMessage(m.reply_to_id!)}>
                          <span className="drawer-quote-label">Replying to {replied?.sender_id === currentUserId ? 'you' : 'member'}</span>
                          <span className="drawer-quote-text">{gifPreviewLabel(replied?.content, replied?.attachments?.length ? 'Attachment' : 'Original message')}</span>
                        </button>
                      )
                    })()}
                    {m.content && <GifContent content={m.content} gifStyle={{ width: 'min(100%, 230px)', maxHeight: 230 }} />}
                    <MessageAttachments attachments={m.attachments ?? []} compact />
                    {isSent && !isPend && (
                      <div style={{ marginTop: 4, fontSize: '0.66rem', textAlign: 'right', opacity: 0.72 }}>
                        {isMessageReadByAllOthers(m, currentUserId, participantIds) ? '✓✓' : '✓'}
                      </div>
                    )}
                  </div>
                  <button type="button" className="drawer-reply-action" onClick={() => { setReplyingTo(m); inputRef.current?.focus() }} aria-label="Reply to message">
                    Reply
                  </button>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="drawer-input-stack">
          {replyingTo && (
            <div className="drawer-reply-preview" role="status">
              <div className="drawer-reply-preview-main">
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#34d399' }}>Replying to {replyingTo.sender_id === currentUserId ? 'your message' : (recipient?.full_name || 'member')}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--ft-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {replyingTo.content || (replyingTo.attachments?.length ? 'Attachment' : 'Message')}
                </div>
              </div>
              <button type="button" className="drawer-reply-cancel" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button>
            </div>
          )}
          {attachedFiles.length > 0 && (
            <div className="drawer-attachment-preview-row" aria-label="Selected attachments">
              {attachedFiles.map((file, index) => (
                <span className="drawer-attachment-chip" key={`${file.name}-${file.lastModified}-${index}`}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                  <span style={{ opacity: 0.68 }}>{formatAttachmentSize(file.size)}</span>
                  <button
                    type="button"
                    className="drawer-attachment-remove"
                    onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {selectedGif && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: 6, borderRadius: 14, border: '1px solid rgba(52,211,153,0.24)', background: 'rgba(15,23,42,0.72)', alignSelf: 'flex-start' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedGif.previewUrl} alt={selectedGif.title} style={{ width: 88, height: 66, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
              <span style={{ maxWidth: 150, color: 'var(--ft-text-secondary)', fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedGif.title || 'GIF'}</span>
            </div>
          )}
          <div className="drawer-input-row">
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
            className="drawer-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={!conversationId || setupLoading || sending}
            aria-label="Attach files"
            title="Attach image or file"
          >
            +
          </button>
          <GifPicker selectedGif={selectedGif} onSelect={setSelectedGif} disabled={!conversationId || setupLoading || sending} compact />
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
            disabled={(!input.trim() && attachedFiles.length === 0 && !selectedGif) || !conversationId || sending || setupLoading}
            aria-label="Send message"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ft-bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
          </div>
        </div>
      </aside>
    </>
  )
}
