'use client'

import React, { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  formatAttachmentSize,
  isImageAttachment,
  MESSAGE_ATTACHMENTS_BUCKET,
  type MessageAttachment,
} from '@/lib/messageAttachments'

interface MessageAttachmentsProps {
  attachments?: MessageAttachment[] | null
  compact?: boolean
}

export default function MessageAttachments({ attachments, compact = false }: MessageAttachmentsProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    const pending = (attachments ?? []).filter(att => att.url && !/^https?:\/\//i.test(att.url))
    if (pending.length === 0) return

    let cancelled = false
    const supabase = createClient()

    void Promise.all(
      pending.map(async att => {
        const { data, error } = await supabase.storage
          .from(MESSAGE_ATTACHMENTS_BUCKET)
          .createSignedUrl(att.url, 60 * 60)
        return error || !data?.signedUrl ? null : [att.url, data.signedUrl] as const
      }),
    ).then(entries => {
      if (cancelled) return
      setSignedUrls(prev => {
        const next = { ...prev }
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1]
        }
        return next
      })
    })

    return () => { cancelled = true }
  }, [attachments])

  const visible = attachments ?? []
  if (visible.length === 0) return null

  return (
    <>
      <div className={`ft-message-attachments${compact ? ' compact' : ''}`}>
        {visible.map(att => {
          const href = /^https?:\/\//i.test(att.url) ? att.url : signedUrls[att.url]
          const isImage = isImageAttachment(att)

          if (isImage) {
            return (
              <button
                key={`${att.url}-${att.name}`}
                type="button"
                className="ft-message-image-button"
                onClick={() => href && setExpandedImage({ src: href, alt: att.name })}
                disabled={!href}
                aria-label={`Open ${att.name}`}
              >
                {href ? (
                  <img src={href} alt={att.name} className="ft-message-image" loading="lazy" />
                ) : (
                  <span className="ft-message-attachment-loading">Loading image…</span>
                )}
              </button>
            )
          }

          return (
            <a
              key={`${att.url}-${att.name}`}
              className="ft-message-file-chip"
              href={href || '#'}
              target="_blank"
              rel="noreferrer"
              download={att.name}
              aria-disabled={!href}
              onClick={event => { if (!href) event.preventDefault() }}
            >
              <span className="ft-message-file-icon" aria-hidden="true">📎</span>
              <span className="ft-message-file-text">
                <span className="ft-message-file-name">{att.name}</span>
                <span className="ft-message-file-size">{formatAttachmentSize(att.size)}</span>
              </span>
              <span className="ft-message-file-download" aria-hidden="true">↗</span>
            </a>
          )
        })}
      </div>

      {expandedImage && (
        <div className="ft-message-image-modal" role="dialog" aria-modal="true" onClick={() => setExpandedImage(null)}>
          <button type="button" className="ft-message-image-close" aria-label="Close image" onClick={() => setExpandedImage(null)}>×</button>
          <img src={expandedImage.src} alt={expandedImage.alt} onClick={event => event.stopPropagation()} />
        </div>
      )}

      <style jsx global>{`
        .ft-message-attachments {
          display: grid;
          gap: 0.45rem;
          margin-top: 0.5rem;
        }
        .ft-message-attachments.compact { margin-top: 0.35rem; }
        .ft-message-image-button {
          display: block;
          padding: 0;
          border: 0;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(15,23,42,0.35);
          cursor: zoom-in;
          max-width: min(280px, 72vw);
        }
        .ft-message-image-button:disabled { cursor: wait; opacity: 0.7; }
        .ft-message-image {
          display: block;
          width: 100%;
          max-height: 260px;
          object-fit: cover;
        }
        .ft-message-attachment-loading {
          display: block;
          padding: 0.8rem;
          color: #94a3b8;
          font-size: 0.78rem;
        }
        .ft-message-file-chip {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          max-width: min(300px, 78vw);
          padding: 0.58rem 0.7rem;
          border-radius: 12px;
          border: 1px solid rgba(148,163,184,0.2);
          background: rgba(15,23,42,0.26);
          color: inherit;
          text-decoration: none;
        }
        .ft-message-file-text { min-width: 0; flex: 1; display: grid; gap: 0.12rem; }
        .ft-message-file-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.82rem; font-weight: 700; }
        .ft-message-file-size { font-size: 0.7rem; opacity: 0.72; }
        .ft-message-file-download { opacity: 0.72; }
        .ft-message-image-modal {
          position: fixed;
          inset: 0;
          z-index: 100000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(0,0,0,0.86);
        }
        .ft-message-image-modal img {
          max-width: 96vw;
          max-height: 88vh;
          border-radius: 14px;
          object-fit: contain;
        }
        .ft-message-image-close {
          position: fixed;
          top: max(1rem, env(safe-area-inset-top));
          right: 1rem;
          width: 44px;
          height: 44px;
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 999px;
          background: rgba(15,23,42,0.8);
          color: white;
          font-size: 1.6rem;
          line-height: 1;
          cursor: pointer;
        }
      `}</style>
    </>
  )
}
