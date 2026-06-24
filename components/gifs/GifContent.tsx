'use client'

import { decodeGifMarker, stripGifMarkers } from '@/lib/gifs'

type GifContentProps = {
  content: string | null | undefined
  textStyle?: React.CSSProperties
  gifStyle?: React.CSSProperties
}

export default function GifContent({ content, textStyle, gifStyle }: GifContentProps) {
  const text = stripGifMarkers(content)
  const gif = decodeGifMarker(content)
  return (
    <>
      {text && <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word', ...textStyle }}>{text}</div>}
      {gif && (
        <a href={gif.pageUrl || gif.url} target="_blank" rel="noreferrer" title={gif.title} style={{ display: 'block', marginTop: text ? 8 : 0 }}>
          {/* External animated GIFs are intentionally rendered with img; next/image does not optimize animated remote GIF playback reliably here. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gif.url}
            alt={gif.title || 'GIF'}
            loading="lazy"
            style={{
              display: 'block',
              width: 'min(100%, 260px)',
              maxHeight: 260,
              objectFit: 'cover',
              borderRadius: 14,
              border: '1px solid rgba(148,163,184,0.18)',
              background: 'rgba(15,23,42,0.65)',
              ...gifStyle,
            }}
          />
        </a>
      )}
    </>
  )
}
