const DEFAULT_MAX_KEYWORDS = 10
const MAX_KEYWORD_LENGTH = 48

type KeywordOptions = {
  lowercase?: boolean
  max?: number
}

/**
 * Convert the keyword input accepted by the UI/API into a bounded, unique list.
 * A string is accepted as a convenience for older clients that send comma- or
 * newline-separated keywords instead of an array.
 */
export function normaliseKeywordList(value: unknown, options: KeywordOptions = {}): string[] {
  const rawItems = (Array.isArray(value) ? value : [value])
    .flatMap(item => typeof item === 'string' ? item.split(/[\n,]/) : [])
  const max = Math.max(1, Math.min(options.max ?? DEFAULT_MAX_KEYWORDS, DEFAULT_MAX_KEYWORDS))
  const seen = new Set<string>()
  const result: string[] = []

  for (const raw of rawItems) {
    if (typeof raw !== 'string') continue
    const trimmed = raw.trim().replace(/^#+/, '').slice(0, MAX_KEYWORD_LENGTH)
    if (!trimmed) continue
    const valueToStore = options.lowercase ? trimmed.toLowerCase() : trimmed
    const dedupeKey = valueToStore.toLocaleLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    result.push(valueToStore)
    if (result.length >= max) break
  }

  return result
}
