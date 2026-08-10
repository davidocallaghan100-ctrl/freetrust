'use client'

import { useRef, useEffect } from 'react'
import BuildMessageImages from './BuildMessageImages'
import BuildLoadingDots from './LoadingDots'

export type SendStage = 'uploading' | 'thinking' | 'rendering' | null

const STAGE_LABEL: Record<Exclude<SendStage, null>, string> = {
  uploading: 'Uploading reference photos…',
  thinking: 'Consulting the AI architect…',
  rendering: 'Rendering your design…',
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  pending?: boolean
  renderError?: boolean
  /** Storage paths (private build-attachments bucket) — for messages loaded from history. */
  imageUrls?: string[]
  /** Local blob: URLs for a message just sent in this session — shown instantly, no signed-URL fetch. */
  localPreviewUrls?: string[]
}

export interface PendingImage {
  file: File
  previewUrl: string
}

interface BuildChatProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (v: string) => void
  onSend: () => void
  sending: boolean
  /** Best-effort client-side stage label shown inside the "thinking" placeholder while sending is true. */
  sendStage?: SendStage
  generateCost: number
  pendingImages: PendingImage[]
  onPickImages: (files: FileList | null) => void
  onRemoveImage: (index: number) => void
  imageError: string | null
  maxImages: number
}

export default function BuildChat({
  messages, input, onInputChange, onSend, sending, sendStage, generateCost,
  pendingImages, onPickImages, onRemoveImage, imageError, maxImages,
}: BuildChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Re-run on sending toggling too (not just message count) so the
  // "thinking" placeholder appearing/disappearing also scrolls into view,
  // not just real new messages landing.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, sending])

  const canSend = (input.trim().length > 0 || pendingImages.length > 0) && !sending

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {messages.length === 0 && (
          <div style={{ color: '#8ca7b5', fontSize: 13, textAlign: 'center', padding: '24px 12px' }}>
            Describe what you want to build — e.g. &ldquo;a two-storey timber-frame garden studio, 6m x 4m, flat roof&rdquo; — and I&apos;ll design it and show it above. You can also attach reference photos of a similar building.
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
            {(m.imageUrls?.length || m.localPreviewUrls?.length) ? (
              <BuildMessageImages imageUrls={m.imageUrls} localPreviewUrls={m.localPreviewUrls} />
            ) : null}
            {m.renderError && (
              <div style={{ marginTop: 6, fontSize: 11.5, color: '#f59e0b' }}>
                ⚠️ Design could not be rendered — try rephrasing.
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div
            style={{
              maxWidth: '88%',
              alignSelf: 'flex-start',
              background: '#0e1f2e',
              border: '1px solid #1c3548',
              borderRadius: 14,
              borderBottomLeftRadius: 4,
              padding: '10px 13px',
              fontSize: 13,
              color: '#8ca7b5',
              display: 'flex',
              alignItems: 'center',
              gap: 9,
            }}
          >
            <BuildLoadingDots />
            <span>{STAGE_LABEL[sendStage ?? 'thinking']}</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div
        style={{
          position: 'sticky', bottom: 0, background: '#0c1a27', borderTop: '1px solid #1c3548',
          padding: '10px 12px calc(10px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8,
        }}
      >
        {imageError && (
          <div style={{ fontSize: 11.5, color: '#f59e0b' }}>{imageError}</div>
        )}

        {pendingImages.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {pendingImages.map((img, i) => (
              <div key={img.previewUrl} style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={`Reference ${i + 1}`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid #1c3548', display: 'block' }}
                />
                <button
                  type="button"
                  onClick={() => onRemoveImage(i)}
                  aria-label={`Remove reference photo ${i + 1}`}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                    background: '#0a1420', border: '1px solid #1c3548', color: '#e6f1f5', fontSize: 12,
                    lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            hidden
            onChange={e => { onPickImages(e.target.files); e.target.value = '' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending || pendingImages.length >= maxImages}
            aria-label="Attach reference photo"
            title="Attach up to 4 reference photos (gallery or camera)"
            style={{
              width: 40, height: 40, borderRadius: '50%', background: '#0e1f2e', border: '1px solid #1c3548',
              color: '#8ca7b5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
              flexShrink: 0, cursor: sending || pendingImages.length >= maxImages ? 'default' : 'pointer',
              opacity: sending || pendingImages.length >= maxImages ? 0.5 : 1,
            }}
          >
            📷
          </button>
          <input
            value={input}
            onChange={e => onInputChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canSend) onSend() }}
            placeholder={`Describe what you want to build, or refine the design… (Generate — ${generateCost} TC)`}
            disabled={sending}
            style={{
              flex: 1, background: '#0e1f2e', border: '1px solid #1c3548', borderRadius: 999,
              padding: '11px 16px', color: '#e6f1f5', fontSize: 13.5, outline: 'none', minWidth: 0,
              opacity: sending ? 0.55 : 1,
              cursor: sending ? 'not-allowed' : 'text',
              transition: 'opacity 0.15s ease',
            }}
          />
          <button
            onClick={onSend}
            disabled={!canSend}
            style={{
              width: 40, height: 40, borderRadius: '50%', background: canSend ? '#2dd4bf' : '#134e4a',
              color: '#04201c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              flexShrink: 0, border: 'none', cursor: canSend ? 'pointer' : 'default',
            }}
          >
            {sending ? <BuildLoadingDots color="#8ca7b5" size={4} /> : '➤'}
          </button>
        </div>
      </div>
    </div>
  )
}
