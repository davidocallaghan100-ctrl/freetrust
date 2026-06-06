'use client'


import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import MessageDrawer from '@/components/profile/MessageDrawer'
import MessageAttachments from '@/components/messaging/MessageAttachments'
import {
  formatAttachmentSize,
  uploadMessageAttachments,
  validateMessageAttachmentFiles,
  type MessageAttachment,
} from '@/lib/messageAttachments'
import {
  applyReadReceipt,
  isMessageReadByOther,
  markMessagesRead,
  type MessageReadReceipt,
} from '@/lib/messageReadReceipts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  email?: string
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  attachments?: MessageAttachment[]
  reply_to_id?: string | null
  read_receipts?: MessageReadReceipt[]
  sender?: Profile
}

interface ConversationItem {
  id: string
  updated_at: string
  last_message?: Message | null
  unread_count: number
  other_user: Profile
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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
  'linear-gradient(135deg,#fb923c,#ea580c)',
]

function pickGradient(id: string): string {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  if (diffMs < 60000) return 'now'
  if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m`
  if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h`
  return d.toLocaleDateString()
}

function messagePreview(message: Message): string {
  if (message.content) return message.content
  const count = message.attachments?.length ?? 0
  if (count === 0) return ''
  return count === 1 ? '📎 Attachment' : `📎 ${count} attachments`
}


// ── Main component ─────────────────────────────────────────────────────────────
export default function MessagesPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading messages…</div>}>
      <MessagesPageInner />
    </Suspense>
  )
}

function MessagesPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<File[]>([])
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [sending, setSending] = useState(false)
  // Inline error for failed sends. Previously `catch { /* optimistic stays */ }`
  // meant a failed INSERT left the optimistic bubble on screen with no
  // indication it was never saved — users reloaded and the message was
  // gone. Now we surface the real Supabase error in a banner above the
  // input with a Retry button.
  const [sendError, setSendError] = useState<string | null>(null)
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null)
  const [pendingResend, setPendingResend] = useState<{ id: string; text: string } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  // New Message modal — live member search dropdown. Replaces the old
  // dead-end "type a name/email" input that went nowhere.
  const [newSearch,        setNewSearch]        = useState('')
  const [newResults,       setNewResults]       = useState<Array<{ id: string; full_name: string | null; avatar_url: string | null; subtitle: string | null }>>([])
  const [newSearchLoading, setNewSearchLoading] = useState(false)
  // When a member is picked from the dropdown, open the inline drawer
  // with that member as the recipient. Same drawer component used on
  // profile pages — zero routing, conversation loads automatically.
  const [drawerRecipient,  setDrawerRecipient]  = useState<{ id: string; full_name: string | null; avatar_url: string | null } | null>(null)
  const [mobileView, setMobileView] = useState<'list' | 'thread'>('list')
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const markedReadRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      loadConversations(user.id)
    })
  }, [router])

  // Auto-open a conversation when ?to=userId is present in the URL.
  // Several pages link to /messages?to=X (job applications, grassroots,
  // connections). The MessageDrawer handles the full lifecycle once
  // we set drawerRecipient.
  useEffect(() => {
    const toUserId = searchParams.get('to')
    if (!toUserId || !userId) return

    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', toUserId)
      .maybeSingle()
      .then(({ data: profile }) => {
        if (profile) {
          setDrawerRecipient({
            id: profile.id as string,
            full_name: (profile.full_name as string | null) ?? null,
            avatar_url: (profile.avatar_url as string | null) ?? null,
          })
        }
      })

    // Clean up the URL so the back button doesn't re-trigger the drawer
    router.replace('/messages')
  }, [searchParams, userId, router])

  // Refresh the conversation list whenever the tab comes back into
  // view so unread counts + last-message previews stay current.
  // Without this, a user who backgrounds the app and comes back
  // sees stale data until they navigate away and return.
  useEffect(() => {
    if (!userId) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadConversations(userId)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [userId])

  // Fetch the conversation list via the /api/messages route, which
  // already returns the correct shape (other_user profile, unread
  // count, last message preview) sorted by last_message_at desc.
  // Previously this page queried conversation_participants directly
  // from the browser, which silently failed due to an infinite-
  // recursion RLS policy on that table — the catch { /* use mock */ }
  // at the end hid the error and the UI rendered an empty list.
  // The RLS is fixed by 20260415000009_messaging_rls.sql, and this
  // API-route path is kept as the canonical fetch so all enrichment
  // (last message, unread count, sort order) lives on the server.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const loadConversations = async (_uid: string) => {
    try {
      const res = await fetch('/api/messages', { cache: 'no-store' })
      if (!res.ok) {
        console.error('[messages] loadConversations failed:', res.status)
        return
      }
      const data = await res.json() as {
        conversations: Array<{
          id:           string
          updated_at:   string
          last_message: Message | null
          unread_count: number
          other_user:   Profile | null
        }>
      }
      const items: ConversationItem[] = (data.conversations ?? [])
        .filter(c => !!c.other_user)
        .map(c => ({
          id:           c.id,
          updated_at:   c.updated_at,
          last_message: c.last_message,
          unread_count: c.unread_count ?? 0,
          other_user:   c.other_user as Profile,
        }))
      setConversations(items)
    } catch (err) {
      console.error('[messages] loadConversations threw:', err)
    }
  }

  // Live member search for the New Message modal.
  //
  // Debounced 250ms so fast typists don't fire a query per keystroke.
  // Empty query → browse mode (first 12 members). Otherwise ilike
  // match on full_name via the existing /api/search endpoint,
  // filtered client-side to `type === 'member'`. Avatars come back
  // in the `avatarUrl` field so the dropdown can render a recognisable
  // list (much better UX than the old "type a name and figure it out"
  // input which went nowhere).
  useEffect(() => {
    if (!showNewModal) return
    let cancelled = false
    const t = setTimeout(async () => {
      setNewSearchLoading(true)
      try {
        const q = newSearch.trim()
        const url = `/api/search?q=${encodeURIComponent(q)}&limit=30`
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setNewResults([])
          return
        }
        const data = await res.json() as {
          hits: Array<{
            id:        string
            type:      string
            title:     string
            subtitle?: string
            avatarUrl?: string | null
          }>
        }
        const members = (data.hits ?? [])
          .filter(h => h.type === 'member' && h.id !== userId)
          .slice(0, 15)
          .map(h => ({
            id:         h.id,
            full_name:  h.title || null,
            avatar_url: h.avatarUrl ?? null,
            subtitle:   h.subtitle ?? null,
          }))
        if (!cancelled) setNewResults(members)
      } catch (err) {
        console.error('[messages] member search failed:', err)
        if (!cancelled) setNewResults([])
      } finally {
        if (!cancelled) setNewSearchLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [newSearch, showNewModal, userId])

  // Reset the search state whenever the modal closes so reopening
  // starts clean.
  useEffect(() => {
    if (!showNewModal) {
      setNewSearch('')
      setNewResults([])
    }
  }, [showNewModal])

  const loadMessages = useCallback(async (convId: string) => {
    try {
      const res = await fetch(`/api/messages/${convId}`, { cache: 'no-store' })
      if (!res.ok) {
        console.error('[messages] loadMessages failed:', res.status)
        setMessages([])
        return
      }
      const data = await res.json() as { messages?: Message[] }
      setMessages(data.messages ?? [])
    } catch (err) {
      console.error('[messages] loadMessages threw:', err)
      setMessages([])
    }
  }, [])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    // Subscribe to new messages
    const supabase = createClient()
    const channel = supabase
      .channel(`msgs:${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages(prev => prev.some(msg => msg.id === payload.new.id)
            ? prev
            : [...prev, payload.new as Message])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reads' },
        (payload) => {
          setMessages(prev => applyReadReceipt(prev, payload.new as Record<string, unknown>))
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeId, loadMessages])

  // Mobile lifecycle — refetch messages and (effectively) re-subscribe
  // whenever the tab comes back into view OR the page is restored from
  // iOS Safari's back/forward cache. Mobile networks drop WebSocket
  // connections aggressively (backgrounding, Wi-Fi handover, screen
  // lock) and the Supabase realtime channel does not auto-recover in
  // a way the old page ever used. Without this, a user who left the
  // chat open, switched apps, and came back would miss every message
  // that arrived in the meantime.
  //
  // We do a plain refetch via loadMessages rather than tearing down
  // and rebuilding the channel — loadMessages pulls the authoritative
  // history from the DB, and the existing subscription keeps firing
  // for new messages as they land. If the channel itself is stale,
  // the INSERT event will be missed once but the next pageshow /
  // visibilitychange catches it.
  useEffect(() => {
    if (!activeId) return
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        console.log('[messages] pageshow persisted — refetching thread')
        loadMessages(activeId)
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[messages] tab became visible — refetching thread')
        loadMessages(activeId)
      }
    }
    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [activeId, loadMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [messages])

  const selectConversation = (id: string) => {
    setActiveId(id)
    setMobileView('thread')
    setSafetyWarning(null)
    setSendError(null)
    setPendingResend(null)
    setAttachedFiles([])
    setReplyingTo(null)
    markedReadRef.current.clear()
    // Mark as read
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
  }

  const doSend = async (text: string, optimisticId: string, attachments: MessageAttachment[], replyToId: string | null): Promise<boolean> => {
    if (!activeId || !userId) return false
    const res = await fetch(`/api/messages/${activeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text, attachments, replyToId }),
    })
    const data = await res.json().catch(() => ({})) as {
      error?: string
      message?: Message
      warning?: string | null
    }
    if (!res.ok || !data.message) {
      // Surface the real Supabase error instead of swallowing it.
      // The optimistic bubble stays on screen (so the user doesn't
      // lose what they typed), but we mark the send as failed and
      // offer a Retry button so they know it never reached the DB.
      console.error('[messages] insert failed:', data.error || res.status)
      setSendError(data.error || 'Message failed to send')
      setPendingResend({ id: optimisticId, text })
      return false
    }
    setMessages(prev => {
      const serverMessage = data.message as Message
      const replaced = prev.map(msg => msg.id === optimisticId ? serverMessage : msg)
      const seen = new Set<string>()
      return replaced.filter(msg => {
        if (seen.has(msg.id)) return false
        seen.add(msg.id)
        return true
      })
    })
    setSafetyWarning(data.warning ?? null)
    setSendError(null)
    setPendingResend(null)
    return true
  }

  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || !activeId || !userId) return
    const text = input.trim()
    const filesToSend = attachedFiles
    const replyTarget = replyingTo
    setInput('')
    setAttachedFiles([])
    setReplyingTo(null)
    setSending(true)
    setSendError(null)
    setSafetyWarning(null)

    // Optimistic
    const optimisticId = `opt_${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: activeId,
      sender_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      attachments: filesToSend.map(file => ({ url: '', type: file.type, name: file.name, size: file.size })),
      reply_to_id: replyTarget?.id ?? null,
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const uploadedAttachments = filesToSend.length > 0
        ? await uploadMessageAttachments(createClient(), filesToSend, { userId, conversationId: activeId })
        : []
      const sent = await doSend(text, optimisticId, uploadedAttachments, replyTarget?.id ?? null)
      if (!sent) {
        setAttachedFiles(filesToSend)
        setReplyingTo(replyTarget)
      }
    } catch (err) {
      // Network / runtime error — same treatment as the Supabase
      // error branch above so the user can see the failure reason
      // and retry.
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[messages] sendMessage threw:', msg)
      setSendError(msg)
      setPendingResend({ id: optimisticId, text })
      setAttachedFiles(filesToSend)
      setReplyingTo(replyTarget)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const retrySend = async () => {
    if (!pendingResend) return
    setSending(true)
    setSendError(null)
    try {
      await doSend(pendingResend.text, pendingResend.id, [], null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSendError(msg)
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
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
    target.classList.add('msg-message-highlight')
    window.setTimeout(() => target.classList.remove('msg-message-highlight'), 1200)
  }

  useEffect(() => {
    if (!userId || !activeId || messages.length === 0) return
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
        console.error('[messages] mark read failed:', err)
        visibleIds.forEach(id => markedReadRef.current.delete(id))
      })
    }, { threshold: 0.6 })

    unreadIncoming.forEach(message => {
      const element = messageRefs.current.get(message.id)
      if (element) observer.observe(element)
    })

    return () => observer.disconnect()
  }, [messages, userId, activeId])

  const activeConv = conversations.find(c => c.id === activeId)
  const filteredConvs = conversations.filter(c =>
    !searchQuery || c.other_user.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const totalUnread = conversations.reduce((a, c) => a + c.unread_count, 0)

  return (
    <div className="msg-root">
      <style>{`
        /* Height — use 100dvh (dynamic viewport) instead of 100vh so
           iOS Safari's collapsing URL bar doesn't hide the bottom of
           the thread behind the browser chrome. 100vh fallback keeps
           older browsers working. Subtract 58 px for the top nav. */
        .msg-root {
          height: calc(100vh - 58px);
          height: calc(100dvh - 58px);
          background:
            radial-gradient(circle at 20% 10%, rgba(45,212,191,0.08), transparent 28%),
            radial-gradient(circle at 80% 0%, rgba(56,189,248,0.07), transparent 24%),
            #07111f;
          color: #f1f5f9;
          font-family: system-ui;
          display: flex;
          overflow: hidden;
        }
        .msg-sidebar { width: 320px; flex-shrink: 0; border-right: 1px solid rgba(56,189,248,0.1); display: flex; flex-direction: column; background: rgba(10,20,35,0.94); }
        .msg-thread { flex: 1; display: flex; flex-direction: column; min-height: 0; background: linear-gradient(180deg, rgba(7,17,31,0.98), rgba(5,15,28,0.98)); }
        .msg-conv-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.9rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(56,189,248,0.05); transition: background 0.12s; }
        .msg-conv-item:hover { background: rgba(56,189,248,0.04); }
        .msg-conv-item.active { background: rgba(56,189,248,0.08); border-left: 2px solid #38bdf8; }
        .msg-bubble-wrap { display: flex; margin-bottom: 0.4rem; }
        .msg-bubble-wrap.sent { justify-content: flex-end; }
        .msg-bubble-wrap.recv { justify-content: flex-start; }
        .msg-bubble { max-width: 72%; padding: 0.7rem 0.9rem 0.45rem; border-radius: 20px; font-size: 0.92rem; line-height: 1.5; word-break: break-word; box-shadow: 0 10px 28px rgba(0,0,0,0.18); }
        .msg-bubble.sent { background: linear-gradient(135deg,#22d3ee,#0ea5e9); color: #effcff; border-bottom-right-radius: 6px; }
        .msg-bubble.recv { background: rgba(30,41,59,0.96); color: #e2e8f0; border-bottom-left-radius: 6px; border: 1px solid rgba(148,163,184,0.1); }
        .msg-bubble-time { display: block; margin-top: 0.3rem; font-size: 0.68rem; line-height: 1; opacity: 0.7; text-align: right; }
        .msg-message-highlight .msg-bubble { box-shadow: 0 0 0 3px rgba(251,191,36,0.55), 0 10px 28px rgba(0,0,0,0.18); }
        .msg-reply-action { align-self: center; border: none; background: transparent; color: #64748b; cursor: pointer; font-size: 0.72rem; padding: 0.25rem 0.4rem; }
        .msg-reply-action:hover { color: #38bdf8; }
        .msg-quote { border-left: 3px solid rgba(45,212,191,0.6); border-radius: 9px; padding: 0.38rem 0.55rem; margin-bottom: 0.45rem; background: rgba(15,23,42,0.18); color: inherit; width: 100%; text-align: left; cursor: pointer; font: inherit; }
        .msg-quote-label { display: block; font-size: 0.68rem; font-weight: 800; opacity: 0.75; margin-bottom: 0.12rem; }
        .msg-quote-text { display: block; font-size: 0.78rem; opacity: 0.86; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .msg-reply-preview { margin: 0.7rem 1rem 0; border: 1px solid rgba(45,212,191,0.22); border-radius: 12px; background: rgba(15,23,42,0.86); padding: 0.58rem 0.7rem; display: flex; gap: 0.7rem; align-items: center; }
        .msg-reply-preview-main { flex: 1; min-width: 0; }
        .msg-reply-cancel { border: none; background: transparent; color: #94a3b8; font-size: 1.2rem; cursor: pointer; }
        .msg-safety-chip { align-self: center; margin: 0.85rem 1rem 0; padding: 0.45rem 0.7rem; border: 1px solid rgba(45,212,191,0.22); border-radius: 999px; background: rgba(20,184,166,0.08); color: #8ff7e5; font-size: 0.76rem; font-weight: 650; }
        .msg-thread-scroll { flex: 1; overflow-y: auto; padding: 1rem 1.25rem 1.25rem; background-image: radial-gradient(rgba(45,212,191,0.08) 1px, transparent 1px); background-size: 34px 34px; }
        .msg-input-area {
          padding: 0.8rem 1rem;
          border-top: 1px solid rgba(56,189,248,0.1);
          display: flex;
          gap: 0.65rem;
          align-items: center;
          background: rgba(10,20,35,0.96);
          flex-shrink: 0;
        }
        .msg-input-stack {
          border-top: 1px solid rgba(56,189,248,0.1);
          background: rgba(10,20,35,0.96);
          flex-shrink: 0;
        }
        .msg-attachment-preview-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          padding: 0.7rem 1rem 0;
        }
        .msg-attachment-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          max-width: 100%;
          border: 1px solid rgba(45,212,191,0.2);
          border-radius: 999px;
          background: rgba(15,23,42,0.86);
          color: #cbd5e1;
          padding: 0.35rem 0.5rem 0.35rem 0.65rem;
          font-size: 0.72rem;
        }
        .msg-attachment-remove {
          border: none;
          border-radius: 999px;
          background: rgba(248,113,113,0.15);
          color: #fca5a5;
          width: 22px;
          height: 22px;
          cursor: pointer;
        }
        .msg-textarea { flex: 1; background: rgba(30,41,59,0.95); border: 1px solid rgba(148,163,184,0.18); border-radius: 999px; color: #f1f5f9; font-family: inherit; font-size: 16px; padding: 0.74rem 1rem; resize: none; outline: none; max-height: 120px; overflow-y: auto; }
        .msg-textarea:focus { border-color: rgba(56,189,248,0.35); }
        .msg-send-btn { background: linear-gradient(135deg,#2dd4bf,#38bdf8); border: none; border-radius: 999px; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: opacity 0.15s, transform 0.15s; box-shadow: 0 10px 24px rgba(34,211,238,0.18); }
        .msg-send-btn:hover { opacity: 0.88; }
        .msg-send-btn:active { transform: scale(0.97); }
        .msg-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .msg-plus-btn { width: 44px; height: 44px; border-radius: 999px; border: 1px solid rgba(45,212,191,0.25); background: rgba(15,23,42,0.86); color: #5eead4; font-size: 1.35rem; line-height: 1; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        @media (max-width: 768px) {
          .msg-sidebar { width: 100%; border-right: none; }
          .msg-thread { width: 100%; }
          .msg-desktop-only { display: none !important; }
          /* BottomNav is position:fixed at 64 px tall and only visible
             below 768 px. Reserve space for it PLUS the iOS home
             indicator safe area so the input area and last message
             bubble aren't hidden behind the nav. */
          .msg-input-area {
            padding-bottom: calc(0.85rem + 64px + env(safe-area-inset-bottom, 0px));
          }
          .msg-bubble { max-width: 84%; font-size: 0.96rem; }
        }
      `}</style>

      {/* Sidebar */}
      <div className="msg-sidebar" style={{ display: mobileView === 'thread' ? 'none' : 'flex' }}>
        {/* Header */}
        <div style={{ padding: '1rem', borderBottom: '1px solid rgba(56,189,248,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>
              Messages {totalUnread > 0 && <span style={{ background: '#ef4444', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.72rem', fontWeight: 700, color: '#fff', marginLeft: '0.35rem' }}>{totalUnread}</span>}
            </h2>
            <button onClick={() => setShowNewModal(true)} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 7, padding: '0.3rem 0.7rem', fontSize: '0.78rem', fontWeight: 700, color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}>
              + New
            </button>
          </div>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search conversations…"
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(56,189,248,0.12)', borderRadius: 8, color: '#f1f5f9', padding: '0.5rem 0.75rem', fontSize: '0.85rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {/* Conversation list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConvs.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💬</div>
              <div style={{ fontSize: '0.85rem' }}>No conversations yet</div>
              <div style={{ fontSize: '0.78rem', marginTop: '0.25rem', color: '#374151' }}>Start one by visiting a profile</div>
            </div>
          ) : filteredConvs.map(conv => (
            <div
              key={conv.id}
              className={`msg-conv-item${activeId === conv.id ? ' active' : ''}`}
              onClick={() => selectConversation(conv.id)}
            >
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: pickGradient(conv.other_user.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', flexShrink: 0, position: 'relative' }}>
                {getInitials(conv.other_user.full_name)}
                {conv.unread_count > 0 && (
                  <span style={{ position: 'absolute', top: -2, right: -2, width: 14, height: 14, background: '#38bdf8', borderRadius: '50%', border: '2px solid #111827', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 700 }}>
                    {conv.unread_count}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: '0.88rem', color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.other_user.full_name || 'Unknown'}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#475569', flexShrink: 0, marginLeft: '0.5rem' }}>
                    {conv.last_message ? formatTime(conv.last_message.created_at) : ''}
                  </span>
                </div>
                {conv.last_message && (
                  <div style={{ fontSize: '0.78rem', color: conv.unread_count > 0 ? '#94a3b8' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: conv.unread_count > 0 ? 600 : 400 }}>
                    {conv.last_message.sender_id === userId ? 'You: ' : ''}{messagePreview(conv.last_message)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div className="msg-thread" style={{ display: mobileView === 'list' && !activeId ? 'none' : 'flex' }}>
        {!activeId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: '#475569' }} className="msg-desktop-only">
            <div style={{ fontSize: '3rem' }}>💬</div>
            <div style={{ fontWeight: 600, color: '#64748b' }}>Select a conversation</div>
            <div style={{ fontSize: '0.85rem' }}>or start a new one above</div>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(10,20,35,0.96)' }}>
              <button onClick={() => { setActiveId(null); setMobileView('list') }} style={{ background: 'none', border: 'none', color: '#dbeafe', cursor: 'pointer', fontSize: '1.35rem', padding: '0.1rem 0.4rem', lineHeight: 1 }}>
                ←
              </button>
              <div style={{ width: 42, height: 42, borderRadius: '50%', background: pickGradient(activeConv?.other_user.id || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 800, color: '#0f172a', flexShrink: 0, position: 'relative', boxShadow: '0 0 0 2px rgba(45,212,191,0.45)' }}>
                {getInitials(activeConv?.other_user.full_name)}
                <span aria-hidden="true" style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: '50%', background: '#2dd4bf', color: '#042f2e', border: '2px solid #0a1423', fontSize: '0.62rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✓</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{activeConv?.other_user.full_name || 'Unknown'}</div>
                <div style={{ fontSize: '0.75rem', color: '#93c5fd' }}>Active Member · FreeTrust protected</div>
              </div>
              <button onClick={() => router.push(`/profile?id=${activeConv?.other_user.id}`)} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.38rem 0.72rem', fontSize: '0.76rem', color: '#7dd3fc', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>
                View Profile
              </button>
            </div>

            <div className="msg-safety-chip">🛡 Verified member conversation · payments stay inside FreeTrust</div>

            {/* Messages */}
            <div className="msg-thread-scroll">
              {messages.map((msg, i) => {
                const isSent = msg.sender_id === userId || msg.sender_id === 'me'
                const prevMsg = messages[i - 1]
                const showTime = !prevMsg || new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000
                return (
                  <React.Fragment key={msg.id}>
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
                      className={`msg-bubble-wrap ${isSent ? 'sent' : 'recv'}`}
                      style={{ gap: '0.25rem' }}
                    >
                      {!isSent && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: pickGradient(msg.sender_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a', flexShrink: 0, marginRight: '0.5rem', alignSelf: 'flex-end' }}>
                          {getInitials(activeConv?.other_user.full_name)}
                        </div>
                      )}
                      <div className={`msg-bubble ${isSent ? 'sent' : 'recv'}`}>
                        {msg.reply_to_id && (() => {
                          const replied = messagesById.get(msg.reply_to_id)
                          return (
                            <button type="button" className="msg-quote" onClick={() => scrollToMessage(msg.reply_to_id!)}>
                              <span className="msg-quote-label">Replying to {replied?.sender_id === userId ? 'you' : 'member'}</span>
                              <span className="msg-quote-text">{replied?.content || (replied?.attachments?.length ? 'Attachment' : 'Original message')}</span>
                            </button>
                          )
                        })()}
                        {msg.content && <div>{msg.content}</div>}
                        <MessageAttachments attachments={msg.attachments ?? []} compact />
                        <span className="msg-bubble-time">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{isSent ? ` ${isMessageReadByOther(msg, userId) ? '✓✓' : '✓'}` : ''}
                        </span>
                      </div>
                      <button type="button" className="msg-reply-action" onClick={() => { setReplyingTo(msg); inputRef.current?.focus() }} aria-label="Reply to message">
                        Reply
                      </button>
                    </div>
                  </React.Fragment>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {/* Inline send-error banner. Shown above the input
                whenever the last send failed — the optimistic bubble
                stays in the thread (so the user can still see what
                they typed) but this banner makes it clear that the
                message never reached the DB, and offers a Retry
                button that replays the same text. */}
            {sendError && (
              <div
                role="alert"
                style={{
                  margin: '0 1rem',
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.3)',
                  borderRadius: 10,
                  padding: '0.55rem 0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  fontSize: '0.78rem',
                  color: '#fca5a5',
                  flexShrink: 0,
                }}
              >
                <span>⚠️</span>
                <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 700, color: '#f87171' }}>Message failed to send</div>
                  <div style={{ wordBreak: 'break-word' }}>{sendError}</div>
                </div>
                {pendingResend && (
                  <button
                    type="button"
                    onClick={retrySend}
                    disabled={sending}
                    style={{
                      background: 'rgba(248,113,113,0.15)',
                      border: '1px solid rgba(248,113,113,0.35)',
                      borderRadius: 7,
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: '#fca5a5',
                      cursor: sending ? 'wait' : 'pointer',
                      fontFamily: 'inherit',
                      minHeight: 32,
                      flexShrink: 0,
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {safetyWarning && !sendError && (
              <div
                role="status"
                style={{
                  margin: '0 1rem',
                  background: 'rgba(20,184,166,0.08)',
                  border: '1px solid rgba(45,212,191,0.24)',
                  borderRadius: 12,
                  padding: '0.55rem 0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.78rem',
                  color: '#99f6e4',
                  flexShrink: 0,
                }}
              >
                <span>🛡</span>
                <span>{safetyWarning}</span>
              </div>
            )}

            {/* Input */}
            <div className="msg-input-stack">
              {replyingTo && (
                <div className="msg-reply-preview" role="status">
                  <div className="msg-reply-preview-main">
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#5eead4' }}>Replying to {replyingTo.sender_id === userId ? 'your message' : (activeConv?.other_user.full_name || 'member')}</div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {replyingTo.content || (replyingTo.attachments?.length ? 'Attachment' : 'Message')}
                    </div>
                  </div>
                  <button type="button" className="msg-reply-cancel" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">×</button>
                </div>
              )}
              {attachedFiles.length > 0 && (
                <div className="msg-attachment-preview-row" aria-label="Selected attachments">
                  {attachedFiles.map((file, index) => (
                    <span className="msg-attachment-chip" key={`${file.name}-${file.lastModified}-${index}`}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <span style={{ opacity: 0.68 }}>{formatAttachmentSize(file.size)}</span>
                      <button
                        type="button"
                        className="msg-attachment-remove"
                        onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                        aria-label={`Remove ${file.name}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="msg-input-area">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"
                onChange={e => onPickFiles(e.target.files)}
              />
              <button
                className="msg-plus-btn"
                type="button"
                aria-label="Add attachment"
                title="Attach image or file"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
              >
                +
              </button>
              <textarea
                ref={inputRef}
                className="msg-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                rows={1}
              />
              <button className="msg-send-btn" onClick={sendMessage} disabled={(!input.trim() && attachedFiles.length === 0) || sending} title="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Message modal — live member search dropdown */}
      {showNewModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '5vh 1rem', zIndex: 9999 }}
          onClick={() => setShowNewModal(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.5rem', maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>New Message</h3>
              <button
                onClick={() => setShowNewModal(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer', lineHeight: 1, padding: '0.25rem 0.5rem' }}
              >
                ×
              </button>
            </div>

            <input
              value={newSearch}
              onChange={e => setNewSearch(e.target.value)}
              placeholder="Search members by name…"
              autoFocus
              style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, color: '#f1f5f9', padding: '0.7rem 0.95rem', fontSize: '16px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '0.75rem' }}
            />

            {/* Results dropdown — scrolls independently inside the modal */}
            <div style={{ flex: 1, overflowY: 'auto', margin: '0 -0.5rem', paddingRight: '0.25rem' }}>
              {newSearchLoading && newResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                  Searching members…
                </div>
              )}

              {!newSearchLoading && newResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', color: '#64748b', fontSize: '0.85rem' }}>
                  {newSearch.trim().length > 0
                    ? 'No members match your search.'
                    : 'Start typing to search members, or browse all →'}
                </div>
              )}

              {newResults.map(m => (
                <button
                  key={m.id}
                  onClick={() => {
                    setDrawerRecipient({
                      id:         m.id,
                      full_name:  m.full_name,
                      avatar_url: m.avatar_url,
                    })
                    setShowNewModal(false)
                  }}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            '0.75rem',
                    width:          '100%',
                    padding:        '0.65rem 0.75rem',
                    background:     'transparent',
                    border:         'none',
                    borderRadius:   8,
                    textAlign:      'left',
                    cursor:         'pointer',
                    color:          '#f1f5f9',
                    fontFamily:     'inherit',
                    minHeight:      56,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(56,189,248,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {m.avatar_url ? (
                    <img
                      src={m.avatar_url}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                      onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{ width: 40, height: 40, borderRadius: '50%', background: pickGradient(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}
                    >
                      {getInitials(m.full_name)}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.full_name || 'Member'}
                    </div>
                    {m.subtitle && (
                      <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(56,189,248,0.1)' }}>
              <button
                onClick={() => { setShowNewModal(false); router.push('/browse') }}
                style={{ width: '100%', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Or browse all members →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline drawer for conversations opened from the New Message
          dropdown. Uses the same MessageDrawer used on profile pages
          so the conversation UX is identical everywhere. */}
      <MessageDrawer
        open={drawerRecipient !== null}
        recipient={drawerRecipient}
        currentUserId={userId}
        onClose={() => {
          setDrawerRecipient(null)
          // Refresh the conversation list so the new thread shows
          // up at the top without a page reload.
          if (userId) void loadConversations(userId)
        }}
      />
    </div>
  )
}
