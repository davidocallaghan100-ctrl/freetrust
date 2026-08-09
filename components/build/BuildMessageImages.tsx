'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BUILD_ATTACHMENTS_BUCKET } from '@/lib/build/attachments'

interface BuildMessageImagesProps {
  /** Storage paths (private bucket) — resolved to signed URLs on mount. */
  imageUrls?: string[] | null
  /** Local blob: URLs for a just-sent message in this session — shown
   *  immediately with no signed-URL round trip. Takes priority over
   *  imageUrls when present. */
  localPreviewUrls?: string[] | null
}

export default function BuildMessageImages({ imageUrls, localPreviewUrls }: BuildMessageImagesProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  const paths = (imageUrls ?? []).filter(Boolean)

  useEffect(() => {
    if (localPreviewUrls && localPreviewUrls.length > 0) return
    if (paths.length === 0) return
    let cancelled = false
    const supabase = createClient()
    void Promise.all(
      paths.map(async path => {
        const { data, error } = await supabase.storage
          .from(BUILD_ATTACHMENTS_BUCKET)
          .createSignedUrl(path, 60 * 60)
        return error || !data?.signedUrl ? null : ([path, data.signedUrl] as const)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths.join('|'), localPreviewUrls])

  const displayUrls = localPreviewUrls && localPreviewUrls.length > 0
    ? localPreviewUrls
    : paths.map(p => signedUrls[p]).filter((u): u is string => !!u)

  if (displayUrls.length === 0) return null

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {displayUrls.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => setExpanded(src)}
            style={{
              width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: '1px solid #1c3548',
              padding: 0, background: '#0e1f2e', cursor: 'zoom-in', flexShrink: 0,
            }}
            aria-label="View reference photo"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Reference photo" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </button>
        ))}
      </div>

      {expanded && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setExpanded(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: '1rem', background: 'rgba(0,0,0,0.86)',
          }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setExpanded(null)}
            style={{
              position: 'fixed', top: 'max(1rem, env(safe-area-inset-top))', right: '1rem', width: 44, height: 44,
              border: '1px solid rgba(255,255,255,0.22)', borderRadius: 999, background: 'rgba(15,23,42,0.8)',
              color: 'white', fontSize: '1.6rem', lineHeight: 1, cursor: 'pointer',
            }}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expanded}
            alt="Reference photo"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '96vw', maxHeight: '88vh', borderRadius: 14, objectFit: 'contain' }}
          />
        </div>
      )}
    </>
  )
}
