// ────────────────────────────────────────────────────────────────────────────
// toPgTextArray — Postgres text[] array literal encoder
// ────────────────────────────────────────────────────────────────────────────
//
// PostgREST's JSON → text[] coercion fails on some Supabase project versions
// with the cryptic error "The string did not match the expected pattern".
// The workaround is to bypass the JSON path by sending a pre-formatted
// PostgreSQL array literal string. Postgres's `array_in` then handles the
// cast directly without touching PostgREST's pattern validator.
//
// This helper centralises the encoding so every route inserting into a
// text[] column uses the same proven format. The inline version that
// originally lived in app/api/rent-share/route.ts was written for the
// same bug — this file is the extraction target for that workaround.
//
// Format reference (PostgreSQL array literal):
//   {}                        empty array
//   {"a","b"}                 two plain strings
//   {"with \"quote\""}        double quote escaped as \"
//   {"a\\b"}                  backslash escaped as \\
//
// Every item is always wrapped in double quotes — including items that
// wouldn't strictly need them — so the Postgres parser always takes the
// quoted path. Avoids edge cases with commas, whitespace, braces, and
// NULL-like tokens (the word "null" unquoted is parsed as SQL NULL).
//
// Example usage:
//
//   import { toPgTextArray } from '@/lib/supabase/text-array'
//
//   const imagesLiteral = toPgTextArray(
//     images.filter(u => typeof u === 'string' && /^https?:\/\//.test(u))
//   )
//
//   await supabase.from('listings').insert({
//     ...,
//     images: imagesLiteral,   // string, not string[]
//   })

/**
 * Encode a string array as a PostgreSQL text[] literal.
 *
 * @param items  Iterable of strings to encode. Non-string entries are
 *               silently dropped so the caller doesn't have to pre-filter
 *               — the filtering can be done in a single pass here.
 * @returns      A string like '{}' or '{"a","b","c"}' that can be sent
 *               as the value of a text[] column in a Supabase insert.
 */
export function toPgTextArray(items: readonly unknown[] | null | undefined): string {
  if (!items) return '{}'
  const strs: string[] = []
  for (const item of items) {
    if (typeof item !== 'string') continue
    strs.push(item)
  }
  if (strs.length === 0) return '{}'
  return (
    '{' +
    strs
      .map(s =>
        '"' +
        s
          // Backslash first — escaping order matters or we'd double-escape
          // the backslashes we've just introduced for quotes.
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
        + '"'
      )
      .join(',') +
    '}'
  )
}

/**
 * Convenience: filter an unknown array to http(s) URLs only, then encode
 * it as a text[] literal. Used by every route that stores user-supplied
 * image URLs so a bad client can't poison the column with javascript:
 * URIs or garbage.
 */
export function toPgUrlArray(items: unknown): string {
  if (!Array.isArray(items)) return '{}'
  return toPgTextArray(
    items.filter(
      (u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u)
    )
  )
}

/**
 * Convenience: filter an unknown array to non-empty trimmed strings, then
 * encode as a text[] literal. Used for `tags`, `delivery_types`, etc.
 * where we want to keep any short string but reject non-string values.
 */
export function toPgTagArray(items: unknown): string {
  if (!Array.isArray(items)) return '{}'
  const cleaned: string[] = []
  for (const item of items) {
    if (typeof item !== 'string') continue
    const trimmed = item.trim()
    if (trimmed.length === 0) continue
    cleaned.push(trimmed)
  }
  return toPgTextArray(cleaned)
}
