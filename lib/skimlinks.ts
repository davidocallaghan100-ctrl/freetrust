const SKIMLINKS_PUBLISHER_ID = process.env.NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID

/**
 * Removes legacy FreeTrust referral UTM parameters that earlier catalogue
 * refreshes stored in retailer URLs. This preserves the raw retailer URL while
 * leaving unrelated retailer/query parameters intact.
 */
export function stripFreetrustReferralParams(rawUrl: string): string {
  if (!rawUrl) return rawUrl

  try {
    const url = new URL(rawUrl)
    const hasFreetrustReferral =
      url.searchParams.get('utm_source') === 'freetrust' ||
      url.searchParams.get('utm_medium') === 'referral' ||
      url.searchParams.get('utm_campaign') === 'external_catalogue'

    if (!hasFreetrustReferral) return rawUrl

    url.searchParams.delete('utm_source')
    url.searchParams.delete('utm_medium')
    url.searchParams.delete('utm_campaign')
    url.searchParams.delete('utm_content')
    return url.toString()
  } catch {
    return rawUrl
  }
}

/**
 * Converts any retailer URL into a Skimlinks affiliate tracking URL.
 * FreeTrust earns commission automatically when users purchase via this link.
 * Format: https://go.skimresources.com?id={PUBLISHER_ID}&url={encoded_url}
 */
export function toAffiliateUrl(rawUrl: string): string {
  const cleanUrl = stripFreetrustReferralParams(rawUrl)
  if (!SKIMLINKS_PUBLISHER_ID || !cleanUrl) return cleanUrl
  if (cleanUrl.includes('skimresources.com') || cleanUrl.includes('skimlinks.com')) return cleanUrl
  if (cleanUrl.includes('freetrust.co')) return cleanUrl

  const encodedUrl = encodeURIComponent(cleanUrl)
  return `https://go.skimresources.com?id=${SKIMLINKS_PUBLISHER_ID}&url=${encodedUrl}`
}

export function isAffiliateTrackingEnabled(): boolean {
  return Boolean(SKIMLINKS_PUBLISHER_ID)
}

export function getDomainFromUrl(url: string): string {
  try {
    const { hostname } = new URL(stripFreetrustReferralParams(url))
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

if (typeof window === 'undefined' && !SKIMLINKS_PUBLISHER_ID) {
  console.warn(
    '[FreeTrust] NEXT_PUBLIC_SKIMLINKS_PUBLISHER_ID is not set. ' +
    'Affiliate links will fall back to raw retailer URLs.'
  )
}
