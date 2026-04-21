'use client'
import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import MessageDrawer from '@/components/profile/MessageDrawer'

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
  const [sending, setSending] = useState(false)
  // Inline error for failed sends. Previously `catch { /* optimistic stays */ }`
  // meant a failed INSERT left the optimistic bubble on screen with no
  // indication it was never saved — users reloaded and the message was
  // gone. Now we surface the real Supabase error in a banner above the
  // input with a Retry button.
  const [sendError, setSendError] = useState<string | null>(null)
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
    const supabase = createClient()
    try {
      const { data } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, full_name, avatar_url)')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
      if (data && data.length > 0) {
        setMessages(data as Message[])
        return
      }
    } catch { /* fall through */ }
    setMessages([])
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
          setMessages(prev => [...prev, payload.new as Message])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
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
    // Mark as read
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
  }

  const doSend = async (text: string, optimisticId: string) => {
    if (!activeId || !userId) return
    const supabase = createClient()
    const { error } = await supabase.from('messages').insert({
      conversation_id: activeId,
      sender_id: userId,
      content: text,
      status: 'sent',
    })
    if (error) {
      // Surface the real Supabase error instead of swallowing it.
      // The optimistic bubble stays on screen (so the user doesn't
      // lose what they typed), but we mark the send as failed and
      // offer a Retry button so they know it never reached the DB.
      console.error('[messages] insert failed:', error)
      setSendError(error.message || 'Message failed to send')
      setPendingResend({ id: optimisticId, text })
      return
    }
    setSendError(null)
    setPendingResend(null)
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeId || !userId) return
    const text = input.trim()
    setInput('')
    setSending(true)
    setSendError(null)

    // Optimistic
    const optimisticId = `opt_${Date.now()}`
    const optimistic: Message = {
      id: optimisticId,
      conversation_id: activeId,
      sender_id: userId,
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      await doSend(text, optimisticId)
    } catch (err) {
      // Network / runtime error — same treatment as the Supabase
      // error branch above so the user can see the failure reason
      // and retry.
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[messages] sendMessage threw:', msg)
      setSendError(msg)
      setPendingResend({ id: optimisticId, text })
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const retrySend = async () => {
    if (!pendingResend) return
    setSending(true)
    setSendError(null)
    try {
      await doSend(pendingResend.text, pendingResend.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSendError(msg)
    }
    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

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
          background: #0f172a;
          color: #f1f5f9;
          font-family: system-ui;
          display: flex;
          overflow: hidden;
        }
        .msg-sidebar { width: 320px; flex-shrink: 0; border-right: 1px solid rgba(56,189,248,0.1); display: flex; flex-direction: column; background: #111827; }
        .msg-thread { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .msg-conv-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.9rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(56,189,248,0.05); transition: background 0.12s; }
        .msg-conv-item:hover { background: rgba(56,189,248,0.04); }
        .msg-conv-item.active { background: rgba(56,189,248,0.08); border-left: 2px solid #38bdf8; }
        .msg-bubble-wrap { display: flex; margin-bottom: 0.4rem; }
        .msg-bubble-wrap.sent { justify-content: flex-end; }
        .msg-bubble-wrap.recv { justify-content: flex-start; }
        .msg-bubble { max-width: 72%; padding: 0.6rem 0.9rem; border-radius: 14px; font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
        .msg-bubble.sent { background: #38bdf8; color: #0f172a; border-bottom-right-radius: 4px; }
        .msg-bubble.recv { background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; border: 1px solid rgba(56,189,248,0.1); }
        .msg-input-area {
          padding: 0.85rem 1rem;
          border-top: 1px solid rgba(56,189,248,0.1);
          display: flex;
          gap: 0.65rem;
          align-items: flex-end;
          background: #111827;
          flex-shrink: 0;
        }
        .msg-textarea { flex: 1; background: #1e293b; border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; color: #f1f5f9; font-family: inherit; font-size: 0.9rem; padding: 0.65rem 0.9rem; resize: none; outline: none; max-height: 120px; overflow-y: auto; }
        .msg-textarea:focus { border-color: rgba(56,189,248,0.35); }
        .msg-send-btn { background: #38bdf8; border: none; border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: opacity 0.15s; }
        .msg-send-btn:hover { opacity: 0.88; }
        .msg-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
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
                    {conv.last_message.sender_id === userId ? 'You: ' : ''}{conv.last_message.content}
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
            <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#111827' }}>
              <button onClick={() => { setActiveId(null); setMobileView('list') }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', padding: '0.1rem 0.4rem', lineHeight: 1 }}>
                ←
              </button>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: pickGradient(activeConv?.other_user.id || ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                {getInitials(activeConv?.other_user.full_name)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{activeConv?.other_user.full_name || 'Unknown'}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Member</div>
              </div>
              <button onClick={() => router.push(`/profile?id=${activeConv?.other_user.id}`)} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 7, padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}>
                View Profile
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
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
                    <div className={`msg-bubble-wrap ${isSent ? 'sent' : 'recv'}`}>
                      {!isSent && (
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: pickGradient(msg.sender_id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a', flexShrink: 0, marginRight: '0.5rem', alignSelf: 'flex-end' }}>
                          {getInitials(activeConv?.other_user.full_name)}
                        </div>
                      )}
                      <div className={`msg-bubble ${isSent ? 'sent' : 'recv'}`}>
                        {msg.content}
                      </div>
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

            {/* Input */}
            <div className="msg-input-area">
              <textarea
                ref={inputRef}
                className="msg-textarea"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message… (Enter to send)"
                rows={1}
              />
              <button className="msg-send-btn" onClick={sendMessage} disabled={!input.trim() || sending} title="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
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
