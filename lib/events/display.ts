const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  Community: ['#0ea5e9', '#0369a1'],
  Business: ['#7c3aed', '#4c1d95'],
  Technology: ['#059669', '#047857'],
  Design: ['#db2777', '#9d174d'],
  Finance: ['#d97706', '#92400e'],
  Sustainability: ['#059669', '#065f46'],
  FreeTrust: ['#0284c7', '#1e40af'],
  Health: ['#ea580c', '#c2410c'],
  Education: ['#7c3aed', '#4338ca'],
  AI: ['#a855f7', '#6d28d9'],
  Startup: ['#0284c7', '#1e40af'],
  Marketing: ['#ea580c', '#c2410c'],
  Web3: ['#4f46e5', '#3730a3'],
  'E-commerce': ['#d97706', '#b45309'],
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function truncate(value: string, max: number) {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trim()}…` : trimmed
}

function formatPosterDate(startsAt?: string | null) {
  if (!startsAt) return 'Upcoming'
  const date = new Date(startsAt)
  if (Number.isNaN(date.getTime())) return 'Upcoming'
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function stripEventSourceAttribution(description: string | null | undefined) {
  if (!description) return ''

  return description
    .replace(/^\s*Sourced\s+from\s+predicthq\.com\s*-\s*/i, '')
    .replace(/^\s*Sourced\s+from\s+predicthq\.com\s*$/i, '')
    .trim()
}

export function isUsableEventImage(url: string | null | undefined): url is string {
  if (!url) return false
  if (url.endsWith('/images/classic-events/')) return false
  return /^https?:\/\//i.test(url)
}

export function eventPosterDataUri(params: {
  title: string
  category?: string | null
  startsAt?: string | null
  location?: string | null
}) {
  const category = params.category || 'Event'
  const [from, to] = CATEGORY_GRADIENTS[category] ?? CATEGORY_GRADIENTS.Community
  const title = escapeXml(truncate(params.title || 'FreeTrust Event', 64))
  const date = escapeXml(formatPosterDate(params.startsAt))
  const location = escapeXml(truncate(params.location || 'FreeTrust', 36))
  const categoryLabel = escapeXml(truncate(category, 24).toUpperCase())

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${title}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${from}"/>
          <stop offset="1" stop-color="${to}"/>
        </linearGradient>
        <radialGradient id="glow" cx="78%" cy="20%" r="60%">
          <stop offset="0" stop-color="#38bdf8" stop-opacity="0.52"/>
          <stop offset="1" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <rect width="1200" height="630" fill="url(#glow)"/>
      <circle cx="1030" cy="112" r="164" fill="#ffffff" opacity="0.08"/>
      <circle cx="104" cy="528" r="220" fill="#020617" opacity="0.18"/>
      <rect x="72" y="72" width="1056" height="486" rx="44" fill="#020617" opacity="0.22" stroke="#ffffff" stroke-opacity="0.22"/>
      <rect x="94" y="96" width="190" height="152" rx="28" fill="#020617" opacity="0.62"/>
      <text x="189" y="142" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800" fill="#94a3b8" letter-spacing="4">EVENT</text>
      <text x="189" y="198" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="900" fill="#f8fafc">${date}</text>
      <rect x="94" y="304" width="220" height="50" rx="25" fill="#ffffff" opacity="0.16"/>
      <text x="204" y="337" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="#f8fafc">${categoryLabel}</text>
      <text x="94" y="430" font-family="Arial, Helvetica, sans-serif" font-size="62" font-weight="900" fill="#ffffff">${title}</text>
      <text x="94" y="492" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#bae6fd">${location}</text>
      <text x="94" y="536" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#cbd5e1" opacity="0.82">FreeTrust events</text>
    </svg>`

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}
