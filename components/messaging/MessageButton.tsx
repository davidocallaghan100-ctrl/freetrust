'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────
// MessageButton — drop-in client button that opens (or starts) a 1:1
// conversation with a given recipient and navigates to the thread.
// ─────────────────────────────────────────────────────────────────────
// Usage:
//   <MessageButton recipientId={member.id} recipientName={member.full_name ?? 'member'} />
//
// Click flow:
//   1. POST /api/conversations { recipientId }
//   2. Receive { conversationId }
//   3. router.push('/messages/' + conversationId)
//
// Never duplicates: the route handler uses find-or-create semantics,
// so a second click on the same recipient lands on the same thread.
//
// Loading state — the button is disabled + shows a spinner label
// while the fetch is in flight.
// Error state — a small inline error toast below the button (fades
// after 4s) so the user knows exactly why the click didn't work.

interface MessageButtonProps {
  recipientId: string
  recipientName?: string
  /** Visual variant — `solid` for primary profile CTA, `ghost` for member cards */
  variant?: 'solid' | 'ghost'
  /** Optional className for host-page styling */
  className?: string
  /** Optional full width */
  fullWidth?: boolean
}

export default function MessageButton({
  recipientId,
  recipientName,
  variant = 'solid',
  className,
  fullWidth = false,
}: MessageButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        conversationId?: string
        error?: string
      }
      if (!res.ok || !data.conversationId) {
        const msg = data.error ?? `Couldn't open chat (HTTP ${res.status})`
        console.error('[MessageButton] open conversation failed:', { status: res.status, ...data })
        setError(msg)
        // Auto-hide the inline error after 4 seconds so the button
        // returns to its idle state without forcing a page refresh.
        setTimeout(() => setError(null), 4000)
        return
      }
      router.push(`/messages/${data.conversationId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[MessageButton] network error:', msg)
      setError('Network error — please try again')
      setTimeout(() => setError(null), 4000)
    } finally {
      setLoading(false)
    }
  }

  const baseStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.55rem 1rem',
    borderRadius: 10,
    fontSize: '0.85rem',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: loading ? 'not-allowed' : 'pointer',
    transition: 'transform 0.1s, background 0.15s, border-color 0.15s',
    opacity: loading ? 0.7 : 1,
    width: fullWidth ? '100%' : undefined,
  }

  const solidStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg,#38bdf8,#0284c7)',
    color: '#0f172a',
    border: 'none',
    boxShadow: '0 4px 14px rgba(56,189,248,0.25)',
  }

  const ghostStyle: React.CSSProperties = {
    background: 'transparent',
    color: '#38bdf8',
    border: '1px solid rgba(56,189,248,0.3)',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: fullWidth ? '100%' : undefined }}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-label={recipientName ? `Message ${recipientName}` : 'Open conversation'}
        className={className}
        style={{
          ...baseStyle,
          ...(variant === 'solid' ? solidStyle : ghostStyle),
        }}
      >
        {loading ? (
          <>⏳ Opening chat…</>
        ) : (
          <>💬 Message{recipientName ? ` ${recipientName.split(' ')[0]}` : ''}</>
        )}
      </button>
      {error && (
        <div
          role="alert"
          style={{
            fontSize: '0.72rem',
            color: '#f87171',
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.2)',
            borderRadius: 6,
            padding: '0.35rem 0.55rem',
            lineHeight: 1.4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
