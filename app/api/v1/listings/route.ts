import { NextRequest } from 'next/server'
import { toPublicListing, parseListingPageParams } from '@/lib/developer-api/developer-api-core'
import {
  authorizeListingRead,
  finalizePublicApiResponse,
  newRequestId,
  publicApiJson,
  publicApiOptions,
} from '@/lib/developer-api/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PUBLIC_LISTING_SELECT = [
  'id', 'product_type', 'title', 'description', 'price', 'currency', 'currency_code',
  'category', 'cover_image', 'images', 'tags',
  'city', 'region', 'country', 'is_remote', 'service_mode', 'avg_rating',
  'review_count', 'created_at', 'seller:profiles!seller_id(full_name,avatar_url,deleted_at)',
].join(',')

export async function OPTIONS() {
  return publicApiOptions()
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const requestId = newRequestId()
  const authorized = await authorizeListingRead(request)
  if (!authorized.ok) {
    authorized.response.headers.set('X-Request-Id', requestId)
    return authorized.response
  }

  const quota = authorized.quota as Record<string, unknown>
  const minuteCount = Number(quota.minute_request_count ?? 0)
  const dayCount = Number(quota.day_request_count ?? 0)
  if (quota.is_allowed !== true) {
    const minuteReset = new Date(String(quota.minute_reset_at ?? Date.now() + 60_000)).getTime()
    const dayReset = new Date(String(quota.day_reset_at ?? Date.now() + 60_000)).getTime()
    const retryAfter = Math.max(1, Math.ceil((Math.min(
      minuteCount > authorized.policy.requestsPerMinute ? minuteReset : Number.POSITIVE_INFINITY,
      dayCount > authorized.policy.requestsPerDay ? dayReset : Number.POSITIVE_INFINITY,
    ) - Date.now()) / 1000))
    const response = publicApiJson({ error: 'Rate limit exceeded.', requestId }, 429, { 'Retry-After': String(retryAfter) })
    return finalizePublicApiResponse(
      authorized.admin,
      authorized.key,
      requestId,
      'GET',
      '/api/v1/listings',
      startedAt,
      response,
      quota,
    )
  }

  const parsed = parseListingPageParams(new URL(request.url))
  if (!parsed.ok) {
    const response = publicApiJson({ error: parsed.message, requestId }, 400)
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings', startedAt, response, quota)
  }

  const { type, page, perPage, category } = parsed.value
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  try {
    let query = authorized.admin
      .from('listings')
      .select(PUBLIC_LISTING_SELECT, { count: 'exact' })
      .eq('product_type', type)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to)
    if (category) query = query.eq('category', category)

    const { data, error, count } = await query
    if (error) {
      console.error('[Developer API] listing query failed', { code: error.code })
      const response = publicApiJson({ error: 'Could not retrieve public listings.', requestId }, 500)
      return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings', startedAt, response, quota)
    }

    const total = count ?? 0
    const response = publicApiJson({
      data: (data ?? []).map(row => toPublicListing(row as unknown as Record<string, unknown>)),
      meta: {
        type,
        page,
        perPage,
        total,
        hasMore: from + (data?.length ?? 0) < total,
      },
      requestId,
    })
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings', startedAt, response, quota)
  } catch {
    const response = publicApiJson({ error: 'Could not retrieve public listings.', requestId }, 500)
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings', startedAt, response, quota)
  }
}
