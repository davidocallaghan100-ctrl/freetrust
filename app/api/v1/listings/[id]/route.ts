import { NextRequest } from 'next/server'
import { isUuid, toPublicListing } from '@/lib/developer-api/developer-api-core'
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings/{id}', startedAt, response, quota)
  }

  if (!isUuid(params.id)) {
    const response = publicApiJson({ error: 'Listing not found.', requestId }, 404)
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings/{id}', startedAt, response, quota)
  }

  try {
    const { data, error } = await authorized.admin
      .from('listings')
      .select(PUBLIC_LISTING_SELECT)
      .eq('id', params.id)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('[Developer API] listing detail query failed', { code: error.code })
      const response = publicApiJson({ error: 'Could not retrieve this listing.', requestId }, 500)
      return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings/{id}', startedAt, response, quota)
    }
    const response = data
      ? publicApiJson({ data: toPublicListing(data as unknown as Record<string, unknown>), requestId })
      : publicApiJson({ error: 'Listing not found.', requestId }, 404)
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings/{id}', startedAt, response, quota)
  } catch {
    const response = publicApiJson({ error: 'Could not retrieve this listing.', requestId }, 500)
    return finalizePublicApiResponse(authorized.admin, authorized.key, requestId, 'GET', '/api/v1/listings/{id}', startedAt, response, quota)
  }
}
