'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { DesignSpec, SectionKey } from '@/lib/build/spec'
import { GENERATE_COST, PDF_COST, DISCLAIMER_TEXT } from '@/lib/build/spec'
import BuildChat, { type ChatMessage } from '@/components/build/BuildChat'
import BuildSections, { type SectionRecord } from '@/components/build/BuildSections'

const BuildViewer = dynamic(() => import('@/components/build/BuildViewer'), { ssr: false })

interface ConversationSummary {
  id: string
  title: string
  updated_at: string
}

interface InsufficientFundsInfo {
  balance: number
  required: number
  action: string
}

export default function BuildPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [designSpec, setDesignSpec] = useState<DesignSpec | null>(null)
  const [renderError, setRenderError] = useState(false)
  const [sections, setSections] = useState<SectionRecord[]>([])
  const [activeSectionKey, setActiveSectionKey] = useState<SectionKey>('brief')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [generatingSection, setGeneratingSection] = useState<SectionKey | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [insufficientFunds, setInsufficientFunds] = useState<InsufficientFundsInfo | null>(null)
  const [loadingConvo, setLoadingConvo] = useState(false)

  const refreshBalance = useCallback(async () => {
    try {
      const res = await fetch('/api/trust')
      if (res.ok) {
        const data = await res.json()
        setBalance(typeof data.balance === 'number' ? data.balance : null)
      }
    } catch { /* non-fatal */ }
  }, [])

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/build/conversations')
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations ?? [])
      }
    } catch { /* non-fatal */ }
  }, [])

  useEffect(() => {
    refreshBalance()
    refreshConversations()
  }, [refreshBalance, refreshConversations])

  const loadConversation = useCallback(async (id: string) => {
    setLoadingConvo(true)
    try {
      const res = await fetch(`/api/build/conversations/${id}`)
      if (!res.ok) return
      const data = await res.json()
      setActiveConversationId(id)
      setMessages((data.messages ?? []).map((m: { id: string; role: string; content: string }) => ({
        id: m.id, role: m.role, content: m.content,
      })))
      setDesignSpec(data.latestDesignSpec ?? null)
      setRenderError(!data.latestDesignSpec && (data.messages ?? []).some((m: { role: string }) => m.role === 'assistant'))
      setSections(data.sections ?? [])
      setActiveSectionKey('brief')
    } finally {
      setLoadingConvo(false)
    }
  }, [])

  const startNewConversation = () => {
    setActiveConversationId(null)
    setMessages([])
    setDesignSpec(null)
    setRenderError(false)
    setSections([])
    setActiveSectionKey('brief')
    setInsufficientFunds(null)
  }

  const handleSend = async () => {
    const message = input.trim()
    if (!message || sending) return
    setInput('')
    setSending(true)
    setInsufficientFunds(null)

    const tempUserId = `tmp-${Date.now()}`
    setMessages(prev => [...prev, { id: tempUserId, role: 'user', content: message }])

    try {
      const res = await fetch('/api/build/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversationId, message }),
      })
      const data = await res.json()

      if (res.status === 402) {
        setInsufficientFunds({ balance: data.balance ?? 0, required: data.required ?? GENERATE_COST, action: 'generate this design' })
        setMessages(prev => prev.filter(m => m.id !== tempUserId))
        setInput(message)
        return
      }
      if (!res.ok) {
        setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: data.error || 'Something went wrong — please try again.' }])
        return
      }

      if (!activeConversationId && data.conversationId) {
        setActiveConversationId(data.conversationId)
        refreshConversations()
      }

      setMessages(prev => [...prev, { id: data.messageId ?? `ai-${Date.now()}`, role: 'assistant', content: data.reply, renderError: data.renderError }])
      if (data.designSpec) {
        setDesignSpec(data.designSpec)
        setRenderError(false)
      } else {
        setRenderError(true)
      }
      if (typeof data.newBalance === 'number') setBalance(data.newBalance)

      // Refresh sections (core sections were upserted server-side).
      const convoId = data.conversationId ?? activeConversationId
      if (convoId) {
        const secRes = await fetch(`/api/build/conversations/${convoId}`)
        if (secRes.ok) {
          const secData = await secRes.json()
          setSections(secData.sections ?? [])
        }
      }
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, { id: `err-${Date.now()}`, role: 'assistant', content: 'Network error — please try again.' }])
    } finally {
      setSending(false)
    }
  }

  const handleGenerateSection = async (key: SectionKey) => {
    if (!activeConversationId) return
    setGeneratingSection(key)
    setInsufficientFunds(null)
    try {
      const res = await fetch('/api/build/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversationId, sectionKey: key }),
      })
      const data = await res.json()
      if (res.status === 402) {
        setInsufficientFunds({ balance: data.balance ?? 0, required: data.required ?? 3, action: 'generate this section' })
        return
      }
      if (!res.ok) {
        alert(data.error || 'Could not generate this section.')
        return
      }
      setSections(prev => {
        const filtered = prev.filter(s => s.section_key !== key)
        return [...filtered, data.section]
      })
      if (typeof data.newBalance === 'number') setBalance(data.newBalance)
    } catch (err) {
      console.error(err)
      alert('Network error — please try again.')
    } finally {
      setGeneratingSection(null)
    }
  }

  const handleDownloadPdf = async () => {
    if (!activeConversationId) return
    setDownloading(true)
    setInsufficientFunds(null)
    try {
      const res = await fetch('/api/build/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: activeConversationId }),
      })
      if (res.status === 402) {
        const data = await res.json()
        setInsufficientFunds({ balance: data.balance ?? 0, required: data.required ?? PDF_COST, action: 'download building steps' })
        return
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        alert(data.error || 'Could not generate the PDF.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `freetrust-build-${activeConversationId.slice(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      refreshBalance()
    } catch (err) {
      console.error(err)
      alert('Network error — please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#0a1420', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px',
        borderBottom: '1px solid #1c3548', background: 'linear-gradient(180deg,#0c1c2a,#0a1420)',
        position: 'sticky', top: 0, zIndex: 20,
      }}>
        <div>
          <h1 style={{ fontSize: 17, margin: 0, color: '#e6f1f5', display: 'flex', alignItems: 'center', gap: 8 }}>🏗️ Build</h1>
          <div style={{ fontSize: 11, color: '#8ca7b5', marginTop: 2 }}>AI architecture design studio</div>
        </div>
        <Link href="/wallet" style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#0c1a27', border: '1px solid #1c3548',
            borderRadius: 999, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#f4c451',
          }}>
            💎 {balance ?? '—'} <small style={{ color: '#8ca7b5', fontWeight: 400, marginLeft: 2 }}>TC</small>
          </div>
        </Link>
      </div>

      {/* Sticky 3D viewer */}
      <div style={{ position: 'sticky', top: 57, zIndex: 10, background: '#081420', borderBottom: '1px solid #1c3548' }}>
        <div style={{ height: '34vh', minHeight: 230 }}>
          <BuildViewer designSpec={designSpec} renderError={renderError} />
        </div>
      </div>

      {/* Persistent disclaimer */}
      <div style={{
        fontSize: 10.5, lineHeight: 1.4, color: '#8ca7b5', padding: '8px 16px', textAlign: 'center',
        borderBottom: '1px solid #1c3548', background: '#0c1a27',
      }}>
        <b style={{ color: '#f59e0b' }}>Conceptual only.</b> {DISCLAIMER_TEXT}
      </div>

      {insufficientFunds && (
        <div style={{
          margin: '10px 16px 0', padding: '10px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.4)', fontSize: 12.5, color: '#f4c451',
        }}>
          You need {insufficientFunds.required} TC to {insufficientFunds.action}, but your balance is {insufficientFunds.balance} TC.{' '}
          <Link href="/wallet" style={{ color: '#2dd4bf', fontWeight: 600 }}>Top up your Trust Wallet →</Link>
        </div>
      )}

      {/* Conversation list */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 14px', overflowX: 'auto', borderBottom: '1px solid #1c3548' }}>
        {conversations.map(c => (
          <button
            key={c.id}
            onClick={() => loadConversation(c.id)}
            style={{
              flexShrink: 0, fontSize: 11, padding: '6px 12px', borderRadius: 999, whiteSpace: 'nowrap',
              border: `1px solid ${c.id === activeConversationId ? '#2dd4bf' : '#1c3548'}`,
              color: c.id === activeConversationId ? '#2dd4bf' : '#8ca7b5',
              background: c.id === activeConversationId ? '#134e4a' : '#0e1f2e',
              cursor: 'pointer',
            }}
          >
            {c.title || 'Untitled design'}
          </button>
        ))}
        <button
          onClick={startNewConversation}
          style={{
            flexShrink: 0, fontSize: 11, fontWeight: 600, padding: '6px 12px', borderRadius: 999,
            border: '1px solid #f4c451', color: '#f4c451', background: 'rgba(244,196,81,0.08)', cursor: 'pointer',
          }}
        >
          + New design
        </button>
      </div>

      {loadingConvo && <div style={{ padding: 14, fontSize: 12, color: '#8ca7b5', textAlign: 'center' }}>Loading…</div>}

      {/* Chat */}
      <BuildChat
        messages={messages}
        input={input}
        onInputChange={setInput}
        onSend={handleSend}
        sending={sending}
        generateCost={GENERATE_COST}
      />

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
        <div style={{
          fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '8px 12px', border: '1px solid #2dd4bf',
          color: '#2dd4bf', background: '#134e4a',
        }}>
          ✨ Generate — {GENERATE_COST} TC (type a message above)
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={!activeConversationId || downloading}
          style={{
            fontSize: 12, fontWeight: 600, borderRadius: 10, padding: '8px 12px', border: '1px solid #f4c451',
            color: '#f4c451', background: 'rgba(244,196,81,0.08)',
            cursor: !activeConversationId || downloading ? 'default' : 'pointer',
            opacity: !activeConversationId ? 0.5 : 1,
          }}
        >
          {downloading ? 'Preparing PDF…' : `⬇ Download Steps — ${PDF_COST} TC`}
        </button>
      </div>

      {/* 12-section tabbed system */}
      {activeConversationId && (
        <BuildSections
          sections={sections}
          activeKey={activeSectionKey}
          onSelect={setActiveSectionKey}
          onGenerate={handleGenerateSection}
          generatingKey={generatingSection}
          disabled={!!generatingSection}
        />
      )}
    </div>
  )
}
