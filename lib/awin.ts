const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID
const AWIN_API_TOKEN = process.env.AWIN_API_TOKEN

type AwinProgramme = {
  id?: number | string
  name?: string
  description?: string
  clickThroughUrl?: string
  displayUrl?: string
  logoUrl?: string
  status?: string
  primarySector?: string
  primaryRegion?: {
    name?: string
    countryCode?: string
  }
}

export interface AwinServiceListing {
  title: string
  provider_name: string
  provider_url: string
  description: string
  thumbnail: string | null
  awin_merchant_id: string
  awin_deeplink: string
  is_awin: boolean
  source: 'awin'
}

let programmesCache: Promise<AwinProgramme[]> | null = null

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'financial-services': ['finance', 'financial', 'bank', 'credit', 'loan', 'accounting'],
  'business-services': ['business services', 'b2b', 'office', 'lead gen', 'web hosting'],
  education: ['education', 'training', 'recruitment', 'books'],
  'health-fitness': ['health', 'fitness', 'sports', 'wellness', 'nutrition'],
  health: ['health', 'beauty', 'pharmaceutical', 'medical', 'wellness'],
  recruitment: ['recruitment', 'training'],
  insurance: ['insurance'],
  legal: ['legal'],
  property: ['property', 'real estate', 'home & garden', 'mortgage'],
}

async function fetchAwinProgrammes(): Promise<AwinProgramme[]> {
  if (!AWIN_PUBLISHER_ID || !AWIN_API_TOKEN) {
    console.warn('[FreeTrust] Awin credentials not set — skipping Awin fetch')
    return []
  }

  if (!programmesCache) {
    programmesCache = fetch(`https://api.awin.com/publishers/${AWIN_PUBLISHER_ID}/programmes`, {
      headers: {
        Authorization: `Bearer ${AWIN_API_TOKEN}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    }).then(async res => {
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`[FreeTrust] Awin programmes API error: ${res.status} ${body.slice(0, 160)}`)
        return []
      }

      const data = await res.json()
      return Array.isArray(data) ? data : []
    }).catch(err => {
      console.warn(`[FreeTrust] Awin programmes fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
      return []
    })
  }

  return programmesCache
}

function matchesCategory(programme: AwinProgramme, categoryTag: string): boolean {
  const keywords = CATEGORY_KEYWORDS[categoryTag] || categoryTag.split(/[-_\s]+/)
  const searchable = [
    programme.primarySector,
    programme.name,
    programme.description,
  ].filter(Boolean).join(' ').toLowerCase()

  return keywords.some(keyword => searchable.includes(keyword.toLowerCase()))
}

/**
 * Fetches service merchant listings from Awin API for a given category tag.
 */
export async function fetchAwinServices(categoryTag: string): Promise<AwinServiceListing[]> {
  try {
    const items = await fetchAwinProgrammes()

    return items
      .filter(item => String(item.status || '').toLowerCase() === 'active')
      .filter(item => matchesCategory(item, categoryTag))
      .slice(0, 10)
      .map(item => {
      const merchantUrl = String(item.displayUrl || '')
      const merchantId = String(item.id || '')
      return {
        title: String(item.name || 'Awin Partner'),
        provider_name: String(item.name || 'Awin Partner'),
        provider_url: merchantUrl,
        description: String(item.description || item.primarySector || ''),
        thumbnail: item.logoUrl ? String(item.logoUrl) : null,
        awin_merchant_id: merchantId,
        awin_deeplink: item.clickThroughUrl || toAwinDeeplink(merchantUrl, merchantId),
        is_awin: true,
        source: 'awin' as const,
      }
    }).filter(item => item.provider_url && item.awin_merchant_id)
  } catch (err) {
    console.warn(`[FreeTrust] Awin fetch failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    return []
  }
}

/**
 * Generates an Awin affiliate deeplink for a given merchant URL.
 * Use this when displaying Awin service listings — always open the deeplink,
 * never the raw merchant URL.
 */
export function toAwinDeeplink(merchantUrl: string, merchantId: string): string {
  if (!AWIN_PUBLISHER_ID || !merchantId || !merchantUrl) return merchantUrl
  return `https://www.awin1.com/cread.php?awinmid=${merchantId}&awinaffid=${AWIN_PUBLISHER_ID}&clickref=freetrust&p=${encodeURIComponent(merchantUrl)}`
}
