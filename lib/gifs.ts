export type GifProvider = 'giphy' | 'curated'

export type GifResult = {
  id: string
  title: string
  url: string
  previewUrl: string
  width: number | null
  height: number | null
  source: GifProvider
  pageUrl?: string | null
}

export const GIF_MARKER_RE = /\n?\[ft-gif:([A-Za-z0-9_-]+)\]/g

function toBase64Url(json: string): string {
  if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
    return window.btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }
  return Buffer.from(json, 'utf8').toString('base64url')
}

function fromBase64Url(encoded: string): string {
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - encoded.length % 4) % 4)
    return decodeURIComponent(escape(window.atob(padded)))
  }
  return Buffer.from(encoded, 'base64url').toString('utf8')
}

export function encodeGifMarker(gif: GifResult): string {
  const safe: GifResult = {
    id: String(gif.id || 'gif').slice(0, 128),
    title: String(gif.title || 'GIF').slice(0, 160),
    url: gif.url,
    previewUrl: gif.previewUrl || gif.url,
    width: Number.isFinite(gif.width) ? gif.width : null,
    height: Number.isFinite(gif.height) ? gif.height : null,
    source: gif.source === 'giphy' ? 'giphy' : 'curated',
    pageUrl: gif.pageUrl || null,
  }
  return `[ft-gif:${toBase64Url(JSON.stringify(safe))}]`
}

export function decodeGifMarker(content: string | null | undefined): GifResult | null {
  if (!content) return null
  GIF_MARKER_RE.lastIndex = 0
  const first = GIF_MARKER_RE.exec(content)
  GIF_MARKER_RE.lastIndex = 0
  const encoded = first?.[1]
  if (!encoded) return null
  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as Partial<GifResult>
    if (!parsed.url || !parsed.previewUrl) return null
    return {
      id: String(parsed.id || 'gif'),
      title: String(parsed.title || 'GIF'),
      url: String(parsed.url),
      previewUrl: String(parsed.previewUrl),
      width: typeof parsed.width === 'number' ? parsed.width : null,
      height: typeof parsed.height === 'number' ? parsed.height : null,
      source: parsed.source === 'giphy' ? 'giphy' : 'curated',
      pageUrl: typeof parsed.pageUrl === 'string' ? parsed.pageUrl : null,
    }
  } catch {
    return null
  }
}

export function stripGifMarkers(content: string | null | undefined): string {
  GIF_MARKER_RE.lastIndex = 0
  const clean = (content ?? '').replace(GIF_MARKER_RE, '').trim()
  GIF_MARKER_RE.lastIndex = 0
  return clean
}

export function appendGifMarker(content: string, gif: GifResult | null): string {
  const text = stripGifMarkers(content)
  if (!gif) return text
  return `${text}${text ? '\n' : ''}${encodeGifMarker(gif)}`
}

export function gifPreviewLabel(content: string | null | undefined, fallback = ''): string {
  const text = stripGifMarkers(content)
  const gif = decodeGifMarker(content)
  if (text) return text
  if (gif) return `GIF: ${gif.title || 'GIF'}`
  return fallback
}
