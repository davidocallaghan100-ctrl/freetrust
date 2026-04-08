'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  sender?: Profile
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
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}

export default function ConversationPage() {
  const params = useParams()
  const router = useRouter()
  const conversationId = params.id as string
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [otherUser, setOtherUser] = useState<Profile | null>(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*, sender:profiles(id, full_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
      if (msgs) setMessages(msgs as Message[])

      // Load other participant
      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id, profile:profiles(id, full_name, avatar_url)')
        .eq('conversation_id', conversationId)
        .neq('user_id', user.id)
        .limit(1)
      if (participants && participants[0]) {
        const p0 = participants[0] as unknown as { profile: Profile | Profile[] }
        const rawProfile = Array.isArray(p0.profile) ? p0.profile[0] : p0.profile
        if (rawProfile) setOtherUser(rawProfile)
      }

      setTimeout(() => bottomRef.current?.scrollIntoView(), 100)

      // Realtime subscription
      const channel = supabase
        .channel(`conv:${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          setMessages(prev => [...prev, payload.new as Message])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [conversationId, router])

  const send = async () => {
    if (!input.trim() || !userId) return
    const text = input.trim()
    setInput('')
    setSending(true)
    const optimistic: Message = { id: `opt_${Date.now()}`, conversation_id: conversationId, sender_id: userId, content: text, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, optimistic])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    try {
      const supabase = createClient()
      await supabase.from('messages').insert({ conversation_id: conversationId, sender_id: userId, content: text, status: 'sent' })
    } catch { /* optimistic stays */ }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ height: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        .conv-bubble { max-width: 72%; padding: 0.6rem 0.9rem; border-radius: 14px; font-size: 0.88rem; line-height: 1.5; word-break: break-word; }
        .conv-bubble.sent { background: #38bdf8; color: #0f172a; border-bottom-right-radius: 4px; }
        .conv-bubble.recv { background: #1e293b; color: #e2e8f0; border-bottom-left-radius: 4px; border: 1px solid rgba(56,189,248,0.1); }
      `}</style>

      {/* Header */}
      <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.1)', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#111827' }}>
        <Link href="/messages" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.2rem', textDecoration: 'none', lineHeight: 1, padding: '0.1rem 0.4rem' }}>
          ←
        </Link>
        {otherUser && (
          <>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: pickGradient(otherUser.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
              {getInitials(otherUser.full_name)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{otherUser.full_name || 'Member'}</div>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {messages.map((msg, i) => {
          const isSent = msg.sender_id === userId
          const prev = messages[i - 1]
          const showTime = !prev || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > 300000
          return (
            <div key={msg.id}>
              {showTime && (
                <div style={{ textAlign: 'center', fontSize: '0.72rem', color: '#475569', margin: '0.75rem 0' }}>
                  {new Date(msg.created_at).toLocaleString()}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: isSent ? 'flex-end' : 'flex-start', marginBottom: '0.3rem' }}>
                {!isSent && otherUser && (
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: pickGradient(otherUser.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a', flexShrink: 0, marginRight: '0.4rem', alignSelf: 'flex-end' }}>
                    {getInitials(otherUser.full_name)}
                  </div>
                )}
                <div className={`conv-bubble ${isSent ? 'sent' : 'recv'}`}>{msg.content}</div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '0.85rem 1rem', borderTop: '1px solid rgba(56,189,248,0.1)', display: 'flex', gap: '0.65rem', alignItems: 'flex-end', background: '#111827' }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message…"
          rows={1}
          style={{ flex: 1, background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, color: '#f1f5f9', fontFamily: 'inherit', fontSize: '0.9rem', padding: '0.65rem 0.9rem', resize: 'none', outline: 'none', maxHeight: 120, overflowY: 'auto' }}
        />
        <button onClick={send} disabled={!input.trim() || sending} style={{ background: '#38bdf8', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !input.trim() || sending ? 0.4 : 1, flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
