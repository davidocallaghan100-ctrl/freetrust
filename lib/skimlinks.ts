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
 * Returns the compliant outbound retailer URL for external product clicks.
 *
 * Skimlinks rejected FreeTrust's publisher application, so product referral
 * clicks must not be routed through Skimlinks. Keep this helper in place so the
 * product flow and click-logging call sites stay stable while returning clean
 * raw retailer URLs.
 */
export function toAffiliateUrl(rawUrl: string): string {
  return stripFreetrustReferralParams(rawUrl)
}

export function isAffiliateTrackingEnabled(): boolean {
  return false
}

export function getDomainFromUrl(url: string): string {
  try {
    const { hostname } = new URL(stripFreetrustReferralParams(url))
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
