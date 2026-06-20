type EventLike = {
  id?: string | null
  title?: string | null
  starts_at?: string | null
  date?: Date | string | null
  location_label?: string | null
  venue_name?: string | null
  venue_address?: string | null
  city?: string | null
  country?: string | null
  external_url?: string | null
  meeting_url?: string | null
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeUrl(value: unknown) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    url.searchParams.delete('ref')
    url.searchParams.delete('utm_source')
    url.searchParams.delete('utm_medium')
    url.searchParams.delete('utm_campaign')
    url.hash = ''
    return `${url.origin}${url.pathname}${url.search}`.toLowerCase()
  } catch {
    return normalizeText(raw)
  }
}

function eventDay(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const raw = String(value ?? '')
  if (!raw) return ''
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? raw.slice(0, 10) : date.toISOString().slice(0, 10)
}

export function eventDisplayDedupeKey(event: EventLike) {
  const title = normalizeText(event.title)
  const day = eventDay(event.starts_at ?? event.date)
  const place = normalizeText(event.location_label ?? event.venue_name ?? event.venue_address ?? [event.city, event.country].filter(Boolean).join(' '))
  const outbound = normalizeUrl(event.external_url ?? event.meeting_url)

  // Ticket providers often expose one exhibition/tour as many adjacent timed
  // entries with unique provider IDs. For browsing, keep the earliest card for
  // the same title + day + venue + official URL. Without a URL, the fallback is
  // title + day + venue.
  return [title, day, place, outbound].filter(Boolean).join('|')
}

export function dedupeEventsForDisplay<T extends EventLike>(events: T[]) {
  const seen = new Set<string>()
  const out: T[] = []
  for (const event of events) {
    const key = eventDisplayDedupeKey(event)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(event)
  }
  return out
}
