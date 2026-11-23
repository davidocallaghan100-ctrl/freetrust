import { randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createApiKeyMaterial, isUuid, LISTINGS_READ_SCOPE } from '@/lib/developer-api/core'
import { developerHubUnavailable, jsonNoStore, readRateLimitPolicy, requireDeveloperOwner } from '@/lib/developer-api/server'

export const dynamic = 'force-dynamic'

const rotateKeySchema = z.object({
  expiresInDays: z.union([z.literal(30), z.literal(90), z.literal(365), z.null()]).optional(),
}).strict()

export async function DELETE(
  request: NextRequest,
  { params }: { params: { appId: string; keyId: string } },
) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error
  if (!isUuid(params.appId) || !isUuid(params.keyId)) return jsonNoStore({ error: 'API key not found.' }, 404)

  try {
    const admin = createAdminClient()
    const { data: app, error: appError } = await admin
      .from('developer_apps')
      .select('id')
      .eq('id', params.appId)
      .eq('owner_id', auth.user.id)
      .maybeSingle()
    if (appError) return developerHubUnavailable(appError)
    if (!app) return jsonNoStore({ error: 'API key not found.' }, 404)

    const { data, error } = await admin
      .from('developer_api_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', params.keyId)
      .eq('app_id', params.appId)
      .is('revoked_at', null)
      .select('id')
      .maybeSingle()
    if (error) {
      console.error('[Developer Hub] key revoke failed', { code: error.code })
      return developerHubUnavailable(error)
    }
    if (!data) return jsonNoStore({ error: 'API key not found or already revoked.' }, 404)
    return jsonNoStore({ revoked: true, id: data.id })
  } catch {
    return developerHubUnavailable()
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { appId: string; keyId: string } },
) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error
  if (!isUuid(params.appId) || !isUuid(params.keyId)) return jsonNoStore({ error: 'API key not found.' }, 404)

  const policy = readRateLimitPolicy()
  if (!policy) {
    return jsonNoStore({ error: 'API key rotation is unavailable until request limits are configured.' }, 503)
  }

  let body: unknown = {}
  try {
    if (request.headers.get('content-length') !== '0') body = await request.json()
  } catch {
    return jsonNoStore({ error: 'Request body must be valid JSON.' }, 400)
  }
  const parsed = rotateKeySchema.safeParse(body)
  if (!parsed.success) return jsonNoStore({ error: 'Use an optional expiry of 30, 90, or 365 days.' }, 400)

  try {
    const admin = createAdminClient()
    const { data: oldKey, error: keyError } = await admin
      .from('developer_api_keys')
      .select('id, name, scopes, expires_at, revoked_at')
      .eq('id', params.keyId)
      .eq('app_id', params.appId)
      .maybeSingle()
    if (keyError) return developerHubUnavailable(keyError)
    if (!oldKey || oldKey.revoked_at) return jsonNoStore({ error: 'API key not found or already revoked.' }, 404)

    const material = createApiKeyMaterial()
    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null
    const nextKeyId = randomUUID()
    const { data: rotatedId, error: rotationError } = await admin.rpc('developer_api_rotate_key', {
      p_owner_id: auth.user.id,
      p_key_id: params.keyId,
      p_new_key_id: nextKeyId,
      p_name: oldKey.name,
      p_key_prefix: material.prefix,
      p_secret_hash: material.secretHash,
      p_scopes: [LISTINGS_READ_SCOPE],
      p_expires_at: expiresAt,
    })

    if (rotationError || rotatedId !== nextKeyId) {
      console.error('[Developer Hub] key rotation failed', { code: rotationError?.code })
      return rotationError ? developerHubUnavailable(rotationError) : jsonNoStore({ error: 'Could not rotate the API key.' }, 500)
    }

    return jsonNoStore({
      id: nextKeyId,
      name: oldKey.name,
      prefix: material.prefix,
      scopes: [LISTINGS_READ_SCOPE],
      expires_at: expiresAt,
      secret: material.token,
      limits: policy,
      notice: 'The previous key has been revoked. Copy this new secret now; it will not be shown again.',
    })
  } catch {
    return developerHubUnavailable()
  }
}
