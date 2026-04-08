'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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

// ── Mock data ──────────────────────────────────────────────────────────────────
const MOCK_CONVERSATIONS: ConversationItem[] = [
  { id: 'c1', updated_at: new Date(Date.now() - 600000).toISOString(), unread_count: 2, other_user: { id: 'u1', full_name: 'Amara Diallo', avatar_url: null }, last_message: { id: 'm1', conversation_id: 'c1', sender_id: 'u1', content: 'Hey, are you available for a quick call tomorrow?', created_at: new Date(Date.now() - 600000).toISOString() } },
  { id: 'c2', updated_at: new Date(Date.now() - 3600000).toISOString(), unread_count: 0, other_user: { id: 'u2', full_name: 'Tom Walsh', avatar_url: null }, last_message: { id: 'm2', conversation_id: 'c2', sender_id: 'me', content: 'Sounds great, I\'ll send the files over now.', created_at: new Date(Date.now() - 3600000).toISOString() } },
  { id: 'c3', updated_at: new Date(Date.now() - 86400000).toISOString(), unread_count: 1, other_user: { id: 'u3', full_name: 'Priya Nair', avatar_url: null }, last_message: { id: 'm3', conversation_id: 'c3', sender_id: 'u3', content: 'I\'d love to collaborate on this project!', created_at: new Date(Date.now() - 86400000).toISOString() } },
  { id: 'c4', updated_at: new Date(Date.now() - 172800000).toISOString(), unread_count: 0, other_user: { id: 'u4', full_name: 'James Okafor', avatar_url: null }, last_message: { id: 'm4', conversation_id: 'c4', sender_id: 'u4', content: 'Thanks for the review, really appreciate it!', created_at: new Date(Date.now() - 172800000).toISOString() } },
]

const MOCK_MESSAGES: Record<string, Message[]> = {
  c1: [
    { id: 'm1a', conversation_id: 'c1', sender_id: 'u1', content: 'Hi! I saw your listing for brand design services.', created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'm1b', conversation_id: 'c1', sender_id: 'me', content: 'Yes! Happy to help. What kind of project do you have in mind?', created_at: new Date(Date.now() - 3000000).toISOString() },
    { id: 'm1c', conversation_id: 'c1', sender_id: 'u1', content: 'It\'s a startup in the fintech space. We need a full brand identity.', created_at: new Date(Date.now() - 2400000).toISOString() },
    { id: 'm1d', conversation_id: 'c1', sender_id: 'me', content: 'Sounds perfect. I\'ve done several fintech brands. Can you share more about the company?', created_at: new Date(Date.now() - 1800000).toISOString() },
    { id: 'm1e', conversation_id: 'c1', sender_id: 'u1', content: 'Hey, are you available for a quick call tomorrow?', created_at: new Date(Date.now() - 600000).toISOString() },
  ],
  c2: [
    { id: 'm2a', conversation_id: 'c2', sender_id: 'u2', content: 'Hi, I purchased your SEO audit package. Just checking in on progress.', created_at: new Date(Date.now() - 86400000).toISOString() },
    { id: 'm2b', conversation_id: 'c2', sender_id: 'me', content: 'Hey Tom! I\'m about 60% through. Lots of technical issues to address.', created_at: new Date(Date.now() - 72000000).toISOString() },
    { id: 'm2c', conversation_id: 'c2', sender_id: 'me', content: 'Sounds great, I\'ll send the files over now.', created_at: new Date(Date.now() - 3600000).toISOString() },
  ],
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationItem[]>(MOCK_CONVERSATIONS)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewModal, setShowNewModal] = useState(false)
  const [newRecipient, setNewRecipient] = useState('')
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

  const loadConversations = async (uid: string) => {
    const supabase = createClient()
    try {
      const { data } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          conversations(id, updated_at, last_message_at),
          profile:profiles(id, full_name, avatar_url)
        `)
        .eq('user_id', uid)
        .order('conversation_id', { ascending: false })

      if (data && data.length > 0) {
        // Build conversation items from real data
        const items: ConversationItem[] = data.map((row: Record<string, unknown>) => ({
          id: (row.conversations as Record<string, unknown>)?.id as string,
          updated_at: ((row.conversations as Record<string, unknown>)?.updated_at as string) || new Date().toISOString(),
          unread_count: 0,
          other_user: row.profile as Profile,
          last_message: null,
        })).filter(item => item.id)
        if (items.length > 0) setConversations(items)
      }
    } catch { /* use mock */ }
  }

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
    setMessages(MOCK_MESSAGES[convId] || [])
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [messages])

  const selectConversation = (id: string) => {
    setActiveId(id)
    setMobileView('thread')
    // Mark as read
    setConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
  }

  const sendMessage = async () => {
    if (!input.trim() || !activeId || !userId) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // Optimistic
    const optimistic: Message = {
      id: `opt_${Date.now()}`,
      conversation_id: activeId,
      sender_id: userId,
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

    try {
      const supabase = createClient()
      await supabase.from('messages').insert({
        conversation_id: activeId,
        sender_id: userId,
        content: text,
        status: 'sent',
      })
    } catch { /* optimistic stays */ }
    setSending(false)
    inputRef.current?.focus()
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
    <div style={{ height: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', display: 'flex', overflow: 'hidden' }}>
      <style>{`
        .msg-sidebar { width: 320px; flex-shrink: 0; border-right: 1px solid rgba(56,189,248,0.1); display: flex; flex-direction: column; background: #111827; }
        .msg-thread { flex: 1; display: flex; flex-direction: column; }
        .msg-conv-item { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.9rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(56,189,248,0.05); transition: background 0.12s; }
        .msg-conv-item:hover { background: rgba(56,189,248,0.04); }
        .msg-conv-item.active { background: rgba(56,189,248,0.08); border-left: 2px solid #38bdf8; }
        .msg-bubble-wrap { display: flex; margin-bottom: 0.4rem; }
        .msg-bubble-wrap.sent { justify-content: flex-end; }
        .msg-bubble-wrap.recv { justify-content: flex-start; }
        .msg-bubble { max-width: 72%; padding: 0.6rem 0.9rem; border-radius: 14px; font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
        .msg-bubble.sent { background: #38bdf8; color: #0f172a; border-bottom-right-radius: 4px; }
        .msg-bubble.recv { background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; border: 1px solid rgba(56,189,248,0.1); }
        .msg-input-area { padding: 0.85rem 1rem; border-top: 1px solid rgba(56,189,248,0.1); display: flex; gap: 0.65rem; align-items: flex-end; background: #111827; }
        .msg-textarea { flex: 1; background: #1e293b; border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; color: #f1f5f9; font-family: inherit; font-size: 0.9rem; padding: 0.65rem 0.9rem; resize: none; outline: none; max-height: 120px; overflow-y: auto; }
        .msg-textarea:focus { border-color: rgba(56,189,248,0.35); }
        .msg-send-btn { background: #38bdf8; border: none; border-radius: 10px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: opacity 0.15s; }
        .msg-send-btn:hover { opacity: 0.88; }
        .msg-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        @media (max-width: 768px) {
          .msg-sidebar { width: 100%; border-right: none; }
          .msg-thread { width: 100%; }
          .msg-desktop-only { display: none !important; }
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

      {/* New Message modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.75rem', maxWidth: 380, width: '90%' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>New Message</h3>
            <input
              value={newRecipient}
              onChange={e => setNewRecipient(e.target.value)}
              placeholder="Search by name or email…"
              style={{ width: '100%', background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, color: '#f1f5f9', padding: '0.65rem 0.9rem', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: '1rem' }}
            />
            <p style={{ fontSize: '0.82rem', color: '#475569', marginBottom: '1.25rem' }}>
              To start a conversation, visit any member&apos;s profile and click &quot;Message&quot;.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewModal(false)} style={{ background: 'transparent', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#94a3b8', cursor: 'pointer', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => { setShowNewModal(false); router.push('/browse') }} style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer', fontFamily: 'inherit' }}>
                Browse Members
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
