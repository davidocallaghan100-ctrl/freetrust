'use client'

import { useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  renderError?: boolean
}

interface BuildChatProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  sending: boolean
  generateCost: number
}

export default function BuildChat({ messages, input, onInputChange, onSend, sending, generateCost }: BuildChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ color: '#8ca7b5', fontSize: 13, textAlign: 'center', padding: '24px 12px' }}>
            Describe what you want to build — e.g. &ldquo;a two-storey timber-frame garden studio, 6m x 4m, flat roof&rdquo; — and I&apos;ll design it and show it above.
          </div>
        )}
        {messages.map(m => (
          <div
            key={m.id}
            style={{
              maxWidth: '88%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              background: m.role === 'user'
                ? 'linear-gradient(135deg, #134e4a, #0f3d3a)'
                : '#0e1f2e',
              border: `1px solid ${m.role === 'user' ? '#134e4a' : '#1c3548'}`,
              borderRadius: 14,
              borderBottomRightRadius: m.role === 'user' ? 4 : 14,
              borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14,
              padding: '10px 13px',
              fontSize: 13.5,
              lineHeight: 1.55,
              color: '#e6f1f5',
              whiteSpace: 'pre-wrap',
              opacity: m.pending ? 0.6 : 1,
            }}
          >
            {m.content}
            {m.renderError && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: '#f59e0b' }}>
                ⚠️ Design could not be rendered — try rephrasing.
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          position: 'sticky', bottom: 0, background: '#0c1a27', borderTop: '1px solid #1c3548',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', gap: 8, alignItems: 'center',
        }}
      >
        <input
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !sending && input.trim()) onSend() }}
          placeholder={`Describe what you want to build, or refine the design… (Generate — ${generateCost} TC)`}
          disabled={sending}
          style={{
            flex: 1, background: '#0e1f2e', border: '1px solid #1c3548', borderRadius: 999,
            padding: '11px 16px', color: '#e6f1f5', fontSize: 13.5, outline: 'none',
          }}
        />
        <button
          onClick={onSend}
          disabled={sending || !input.trim()}
          style={{
            width: 40, height: 40, borderRadius: '50%', background: sending || !input.trim() ? '#134e4a' : '#2dd4bf',
            color: '#04201c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            flexShrink: 0, border: 'none', cursor: sending || !input.trim() ? 'default' : 'pointer',
          }}
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>
  )
}
