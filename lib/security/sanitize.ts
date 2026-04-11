/**
 * Input sanitisation utilities
 * - Strips XSS / dangerous HTML from user content
 * - URL validation
 * - Filename sanitisation for uploads
 */

// Lazy-load DOMPurify so modules that only need sanitizeFilename / sanitizeUrl
// don't crash when isomorphic-dompurify is unavailable (e.g. missing native deps).
let _DOMPurify: typeof import('isomorphic-dompurify').default | null = null
function getDOMPurify() {
  if (!_DOMPurify) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _DOMPurify = require('isomorphic-dompurify') as typeof import('isomorphic-dompurify').default
  }
  return _DOMPurify
}

/** Strip all HTML tags — safe plain-text output */
export function sanitizeText(input: unknown): string {
  if (typeof input !== 'string') return ''
  return getDOMPurify().sanitize(input, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim()
}

/** Allow a safe subset of HTML (bold, italic, lists, links) */
export function sanitizeRichText(input: unknown): string {
  if (typeof input !== 'string') return ''
  return getDOMPurify().sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'p', 'br', 'a'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    FORCE_BODY: true,
  }).trim()
}

/** Validate and sanitise a URL — returns null if unsafe */
export function sanitizeUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) return null
    // Block localhost / private IPs (SSRF protection)
    const hostname = url.hostname.toLowerCase()
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local')
    ) {
      return null
    }
    return url.toString()
  } catch {
    return null
  }
}

/** Sanitise a filename — strip path traversal, dangerous chars */
export function sanitizeFilename(name: string): string {
  return name
    .replace(/\.\./g, '')          // path traversal
    .replace(/[/\\:*?"<>|]/g, '_') // illegal chars
    .replace(/^\./, '_')            // hidden file prefix
    .slice(0, 255)                  // max filename length
}

/** Strip leading/trailing whitespace and null bytes from any string */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return ''
  return input.replace(/\0/g, '').trim()
}
