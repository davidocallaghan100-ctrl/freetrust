import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createApiKeyMaterial, isUuid, LISTINGS_READ_SCOPE } from '@/lib/developer-api/core'
import { developerHubUnavailable, jsonNoStore, readRateLimitPolicy, requireDeveloperOwner } from '@/lib/developer-api/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const createKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.array(z.literal(LISTINGS_READ_SCOPE)).min(1).max(1).optional(),
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).optional(),
}).strict()

async function ownedApp(admin: ReturnType<typeof createAdminClient>, appId: string, ownerId: string) {
  const { data, error } = await admin
    .from('developer_apps')
    .select('id, status')
    .eq('id', appId)
    .eq('owner_id', ownerId)
    .maybeSingle()
  return { data, error }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string } },
) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error
  if (!isUuid(params.appId)) return jsonNoStore({ error: 'App not found.' }, 404)

  try {
    const admin = createAdminClient()
    const app = await ownedApp(admin, params.appId, auth.user.id)
    if (app.error) return developerHubUnavailable(app.error)
    if (!app.data) return jsonNoStore({ error: 'App not found.' }, 404)

    const { data, error } = await admin
      .from('developer_api_keys')
      .select('id, name, key_prefix, scopes, expires_at, last_used_at, revoked_at, created_at')
      .eq('app_id', params.appId)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Developer Hub] key list failed', { code: error.code })
      return developerHubUnavailable(error)
    }
    return jsonNoStore({ keys: data ?? [] })
  } catch {
    return developerHubUnavailable()
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { appId: string } },
) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error
  if (!isUuid(params.appId)) return jsonNoStore({ error: 'App not found.' }, 404)

  const policy = readRateLimitPolicy()
  if (!policy) {
    return jsonNoStore({ error: 'API key creation is unavailable until request limits are configured.' }, 503)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonNoStore({ error: 'Request body must be valid JSON.' }, 400)
  }
  const parsed = createKeySchema.safeParse(body)
  if (!parsed.success) {
    return jsonNoStore({ error: 'Use a key name, the listings:read scope, and an optional expiry of 30, 90, or 365 days.' }, 400)
  }

  try {
    const admin = createAdminClient()
    const app = await ownedApp(admin, params.appId, auth.user.id)
    if (app.error) return developerHubUnavailable(app.error)
    if (!app.data || app.data.status !== 'active') return jsonNoStore({ error: 'App not found.' }, 404)

    const material = createApiKeyMaterial()
    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null
    const { data, error } = await admin
      .from('developer_api_keys')
      .insert({
        app_id: params.appId,
        name: parsed.data.name,
        key_prefix: material.prefix,
        secret_hash: material.secretHash,
        scopes: [LISTINGS_READ_SCOPE],
        expires_at: expiresAt,
      })
      .select('id, name, key_prefix, scopes, expires_at, created_at')
      .single()

    if (error || !data) {
      console.error('[Developer Hub] key create failed', { code: error?.code })
      return error ? developerHubUnavailable(error) : jsonNoStore({ error: 'Could not create the API key.' }, 500)
    }
    return jsonNoStore({
      key: data,
      secret: material.token,
      limits: policy,
      notice: 'Copy this secret now. It will not be shown again.',
    }, 201)
  } catch {
    return developerHubUnavailable()
  }
}
