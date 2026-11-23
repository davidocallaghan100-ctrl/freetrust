import { randomUUID } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSessionClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LISTINGS_READ_SCOPE, parseDeveloperBearer, verifyApiKeyToken } from '@/lib/developer-api/developer-api-core'

export type RequestOwner = { user: User; error: null } | { user: null; error: NextResponse }
export type DeveloperApiKey = { id: string; app_id: string; scopes: string[] }
export type RateLimitPolicy = { requestsPerMinute: number; requestsPerDay: number }
export type DeveloperApiAuth =
  | { ok: true; admin: ReturnType<typeof createAdminClient>; key: DeveloperApiKey }
  | { ok: false; response: NextResponse }

function applyCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  response.headers.set('Access-Control-Max-Age', '600')
  response.headers.set('Vary', 'Authorization')
  return response
}

export function jsonNoStore(data: unknown, status = 200, headers?: HeadersInit) {
  const response = NextResponse.json(data, { status })
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  if (headers) new Headers(headers).forEach((value, key) => response.headers.set(key, value))
  return response
}

export function publicApiJson(data: unknown, status = 200, headers?: HeadersInit) {
  return applyCors(jsonNoStore(data, status, headers))
}

export function publicApiOptions() {
  return applyCors(new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }))
}

export function readRateLimitPolicy(): RateLimitPolicy | null {
  const requestsPerMinute = readPositiveLimit(process.env.FREETRUST_DEVELOPER_API_REQUESTS_PER_MINUTE)
  const requestsPerDay = readPositiveLimit(process.env.FREETRUST_DEVELOPER_API_REQUESTS_PER_DAY)
  if (!requestsPerMinute || !requestsPerDay) return null
  return { requestsPerMinute, requestsPerDay }
}

function readPositiveLimit(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= 1_000_000 ? parsed : null
}

export async function requireDeveloperOwner(request: NextRequest): Promise<RequestOwner> {
  try {
    const sessionClient = await createSessionClient()
    const { data: { user }, error } = await sessionClient.auth.getUser()
    if (!error && user) return { user, error: null }

    // Mobile/PWA clients can have a fresh Supabase bearer session before the
    // SSR cookie reaches the route. Validate the JWT with Supabase server-side.
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
    if (bearer && bearer.length <= 4096) {
      const admin = createAdminClient()
      const tokenAuth = await admin.auth.getUser(bearer)
      if (!tokenAuth.error && tokenAuth.data.user) return { user: tokenAuth.data.user, error: null }
    }
  } catch {
    // Keep provider details out of caller-visible authentication errors.
  }
  return { user: null, error: jsonNoStore({ error: 'Authentication required.' }, 401) }
}

export async function authenticateDeveloperApiKey(request: NextRequest): Promise<DeveloperApiAuth> {
  const parsed = parseDeveloperBearer(request.headers.get('authorization'))
  if (!parsed) return { ok: false, response: publicApiJson({ error: 'A valid bearer API key is required.' }, 401) }

  try {
    const admin = createAdminClient()
    const { data: key, error: keyError } = await admin
      .from('developer_api_keys')
      .select('id, app_id, secret_hash, scopes, revoked_at, expires_at')
      .eq('key_prefix', parsed.prefix)
      .maybeSingle()

    if (keyError) {
      console.error('[Developer API] key lookup failed', { code: keyError.code })
      return { ok: false, response: publicApiJson({ error: 'Developer API is temporarily unavailable.' }, 503) }
    }
    if (!key || key.revoked_at || (key.expires_at && new Date(key.expires_at).getTime() <= Date.now()) || !verifyApiKeyToken(parsed.token, key.secret_hash)) {
      return { ok: false, response: publicApiJson({ error: 'A valid bearer API key is required.' }, 401) }
    }

    const { data: app, error: appError } = await admin
      .from('developer_apps')
      .select('id, status')
      .eq('id', key.app_id)
      .maybeSingle()
    if (appError) {
      console.error('[Developer API] app lookup failed', { code: appError.code })
      return { ok: false, response: publicApiJson({ error: 'Developer API is temporarily unavailable.' }, 503) }
    }
    if (!app || app.status !== 'active') return { ok: false, response: publicApiJson({ error: 'A valid bearer API key is required.' }, 401) }

    return {
      ok: true,
      admin,
      key: { id: key.id, app_id: key.app_id, scopes: Array.isArray(key.scopes) ? key.scopes : [] },
    }
  } catch {
    return { ok: false, response: publicApiJson({ error: 'Developer API is temporarily unavailable.' }, 503) }
  }
}

export async function consumeDeveloperQuota(
  admin: ReturnType<typeof createAdminClient>,
  keyId: string,
  policy: RateLimitPolicy,
) {
  const { data, error } = await admin.rpc('developer_api_consume_quota', {
    p_key_id: keyId,
    p_now: new Date().toISOString(),
    p_requests_per_minute: policy.requestsPerMinute,
    p_requests_per_day: policy.requestsPerDay,
  })
  if (error) {
    console.error('[Developer API] quota reservation failed', { code: error.code })
    return null
  }
  return Array.isArray(data) ? data[0] ?? null : data
}

export async function recordDeveloperApiUsage(
  admin: ReturnType<typeof createAdminClient>,
  key: DeveloperApiKey,
  requestId: string,
  method: string,
  path: string,
  statusCode: number,
  startedAt: number,
) {
  const { error } = await admin.from('developer_api_usage').insert({
    id: requestId,
    app_id: key.app_id,
    api_key_id: key.id,
    method,
    path,
    status_code: statusCode,
    response_time_ms: Math.max(0, Math.round(Date.now() - startedAt)),
  })
  if (error) {
    console.error('[Developer API] usage recording failed', { code: error.code })
    return false
  }
  const { error: touchError } = await admin
    .from('developer_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', key.id)
  if (touchError) console.error('[Developer API] last-used update failed', { code: touchError.code })
  return true
}

export function newRequestId() {
  return randomUUID()
}

export async function authorizeListingRead(request: NextRequest) {
  const auth = await authenticateDeveloperApiKey(request)
  if (!auth.ok) return { ok: false as const, response: auth.response }
  if (!auth.key.scopes.includes(LISTINGS_READ_SCOPE)) {
    return { ok: false as const, response: publicApiJson({ error: 'This API key does not have listings:read scope.' }, 403) }
  }

  const policy = readRateLimitPolicy()
  if (!policy) return { ok: false as const, response: publicApiJson({ error: 'Developer API limits are not configured.' }, 503) }
  const quota = await consumeDeveloperQuota(auth.admin, auth.key.id, policy)
  if (!quota) return { ok: false as const, response: publicApiJson({ error: 'Developer API is temporarily unavailable.' }, 503) }
  return { ok: true as const, admin: auth.admin, key: auth.key, policy, quota }
}

export async function finalizePublicApiResponse(
  admin: ReturnType<typeof createAdminClient>,
  key: DeveloperApiKey,
  requestId: string,
  method: string,
  path: string,
  startedAt: number,
  response: NextResponse,
  quota?: Record<string, unknown> | null,
) {
  const recorded = await recordDeveloperApiUsage(admin, key, requestId, method, path, response.status, startedAt)
  if (!recorded) {
    return publicApiJson({ error: 'Request accounting is temporarily unavailable.', requestId }, 503, { 'X-Request-Id': requestId })
  }

  response.headers.set('X-Request-Id', requestId)
  const policy = readRateLimitPolicy()
  if (policy) {
    const minuteCount = Number(quota?.minute_request_count ?? 0)
    const dayCount = Number(quota?.day_request_count ?? 0)
    response.headers.set('X-RateLimit-Limit-Minute', String(policy.requestsPerMinute))
    response.headers.set('X-RateLimit-Remaining-Minute', String(Math.max(0, policy.requestsPerMinute - minuteCount)))
    response.headers.set('X-RateLimit-Limit-Day', String(policy.requestsPerDay))
    response.headers.set('X-RateLimit-Remaining-Day', String(Math.max(0, policy.requestsPerDay - dayCount)))
  }
  return response
}

export function isUnprovisionedDeveloperHubError(error: { code?: string | null } | null | undefined) {
  return Boolean(error?.code && ['42P01', '42883', 'PGRST202', 'PGRST204'].includes(error.code))
}

export function developerHubUnavailable(error?: { code?: string | null } | null) {
  return jsonNoStore({
    error: isUnprovisionedDeveloperHubError(error)
      ? 'The Developer Hub database migration has not been applied.'
      : 'Developer Hub data is temporarily unavailable.',
  }, 503)
}
