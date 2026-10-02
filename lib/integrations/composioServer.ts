import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  COMPOSIO_PROVIDER_CATALOG,
  getComposioProvider,
  type ComposioProvider,
  type ComposioProviderDefinition,
} from './composioCatalog'

const COMPOSIO_API_BASE_URL = 'https://backend.composio.dev/api/v3.1'

type StoredConnectionState = {
  sessionId: string | null
  connectedAccountId: string | null
  userId: string
  provider: ComposioProvider
}

type StoredIntegration = {
  id: string
  provider: ComposioProvider
  toolkit: string
  status: 'pending' | 'active' | 'error' | 'disconnected' | 'revoked'
  external_account_name: string | null
  encrypted_connection_state: string | null
  last_verified_at: string | null
  last_error_code: string | null
  created_at: string
  updated_at: string
}

type IntegrationError = Error & { status?: number; code?: string; data?: unknown }

function getComposioApiKey() {
  const key = process.env.COMPOSIO_API_KEY?.trim()
  if (!key) {
    throw Object.assign(new Error('Composio integrations are not configured on this server.'), {
      code: 'composio_not_configured',
      status: 503,
    })
  }
  return key
}

function cleanError(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const body = data as Record<string, unknown>
    const nested = body.error
    if (typeof nested === 'string') return nested.slice(0, 240)
    if (nested && typeof nested === 'object' && typeof (nested as Record<string, unknown>).message === 'string') {
      return String((nested as Record<string, unknown>).message).slice(0, 240)
    }
    if (typeof body.message === 'string') return body.message.slice(0, 240)
  }
  return fallback
}

async function composioRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${COMPOSIO_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-api-key': getComposioApiKey(),
      ...(options.headers ?? {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const error = Object.assign(new Error(cleanError(data, 'Composio request failed.')), {
      status: response.status,
      data,
    }) as IntegrationError
    throw error
  }
  return (data ?? {}) as Record<string, unknown>
}

function getEncryptionKey() {
  // A dedicated key is preferred. The service-role key fallback keeps the
  // feature deployable without another secret while keeping this reference
  // server-only and encrypted at rest.
  const secret = process.env.COMPOSIO_ENCRYPTION_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!secret) throw new Error('Missing server encryption secret for Composio integrations.')
  return createHash('sha256').update(secret).digest()
}

function encryptConnectionState(state: StoredConnectionState) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(state), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`
}

function decryptConnectionState(value: string | null): StoredConnectionState | null {
  if (!value) return null
  try {
    const [version, ivValue, tagValue, encryptedValue] = value.split(':')
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) return null
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const parsed = JSON.parse(decrypted) as StoredConnectionState
    return parsed && typeof parsed === 'object' && typeof parsed.userId === 'string' ? parsed : null
  } catch {
    return null
  }
}

function composioPayload(data: Record<string, unknown>) {
  let payload = data
  if (payload.data && typeof payload.data === 'object') payload = payload.data as Record<string, unknown>
  if (payload.data && typeof payload.data === 'object' && !payload.status) payload = payload.data as Record<string, unknown>
  return payload
}

function getSessionId(data: Record<string, unknown>) {
  const payload = composioPayload(data)
  return (payload.session_id || payload.sessionId || payload.id) as string | null | undefined
}

function getConnectedAccountId(data: Record<string, unknown>) {
  const payload = composioPayload(data)
  const connected = payload.connected_account
  return (
    payload.connected_account_id
    || payload.connectedAccountId
    || (connected && typeof connected === 'object' ? (connected as Record<string, unknown>).id : null)
  ) as string | null | undefined
}

function getRedirectUrl(data: Record<string, unknown>) {
  const payload = composioPayload(data)
  return (payload.redirect_url || payload.redirectUrl || payload.link) as string | null | undefined
}

function accountPayload(data: Record<string, unknown>) {
  const payload = composioPayload(data)
  if (payload.account && typeof payload.account === 'object') return payload.account as Record<string, unknown>
  return payload
}

function accountStatus(account: Record<string, unknown>) {
  return String(account.status || account.connection_status || '').toUpperCase()
}

function accountName(account: Record<string, unknown>) {
  const state = account.state
  const stateValue = state && typeof state === 'object' ? (state as Record<string, unknown>).val : null
  const stateObject = stateValue && typeof stateValue === 'object' ? stateValue as Record<string, unknown> : null
  const value = account.name || account.account_name || account.email
    || stateObject?.displayName || stateObject?.display_name || stateObject?.email
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 160) : null
}

function mapRemoteStatus(status: string, fallback: StoredIntegration['status']): StoredIntegration['status'] {
  if (status === 'ACTIVE') return 'active'
  if (status === 'FAILED' || status === 'EXPIRED') return 'error'
  if (status === 'DISABLED' || status === 'REVOKED' || status === 'NOT_FOUND') return 'revoked'
  return fallback
}

function publicIntegration(definition: ComposioProviderDefinition, row: StoredIntegration | null) {
  return {
    provider: definition.provider,
    name: definition.name,
    icon: definition.icon,
    description: definition.description,
    capabilities: definition.capabilities,
    tone: definition.tone,
    status: row?.status ?? 'not_connected',
    connected: row?.status === 'active',
    accountName: row?.external_account_name ?? null,
    lastVerifiedAt: row?.last_verified_at ?? null,
    lastErrorCode: row?.last_error_code ?? null,
  }
}

async function listRows(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('member_integrations')
    .select('id,provider,toolkit,status,external_account_name,encrypted_connection_state,last_verified_at,last_error_code,created_at,updated_at')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
  return (data ?? []) as StoredIntegration[]
}

async function patchRow(userId: string, provider: ComposioProvider, patch: Record<string, unknown>) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('member_integrations')
    .update(patch)
    .eq('user_id', userId)
    .eq('provider', provider)
    .select('id,provider,toolkit,status,external_account_name,encrypted_connection_state,last_verified_at,last_error_code,created_at,updated_at')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as StoredIntegration | null
}

async function refreshRow(userId: string, row: StoredIntegration) {
  const state = decryptConnectionState(row.encrypted_connection_state)
  if (!state?.connectedAccountId || row.status === 'disconnected') return row

  try {
    const remote = await composioRequest(`/connected_accounts/${encodeURIComponent(state.connectedAccountId)}`)
    const account = accountPayload(remote)
    const nextStatus = mapRemoteStatus(accountStatus(account), row.status)
    const updated = await patchRow(userId, row.provider, {
      status: nextStatus,
      external_account_name: accountName(account) ?? row.external_account_name,
      last_verified_at: nextStatus === 'active' ? new Date().toISOString() : row.last_verified_at,
      last_error_code: nextStatus === 'error' || nextStatus === 'revoked'
        ? `composio_account_${accountStatus(account).toLowerCase() || 'unavailable'}`
        : null,
    })
    return updated ?? row
  } catch (error) {
    if ((error as IntegrationError).status === 404) {
      return (await patchRow(userId, row.provider, {
        status: 'revoked',
        last_error_code: 'composio_account_not_found',
      })) ?? row
    }
    throw error
  }
}

export async function getMemberComposioIntegrations(userId: string) {
  const rows = await listRows(userId)
  const refreshed: StoredIntegration[] = []
  for (const row of rows) refreshed.push(await refreshRow(userId, row))
  const byProvider = new Map(refreshed.map((row) => [row.provider, row]))
  return COMPOSIO_PROVIDER_CATALOG.map((definition) => publicIntegration(definition, byProvider.get(definition.provider) ?? null))
}

export async function connectMemberComposioIntegration(userId: string, provider: ComposioProvider) {
  const definition = getComposioProvider(provider)
  if (!definition) throw Object.assign(new Error('Unsupported integration provider.'), { status: 400, code: 'unsupported_provider' })

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://freetrust.co').replace(/\/$/, '')
  const callbackUrl = `${baseUrl}/settings?tab=integrations&composio=connected&provider=${encodeURIComponent(provider)}`
  const session = await composioRequest('/tool_router/session', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      toolkits: { enable: [definition.toolkit] },
      manage_connections: {
        enable: true,
        callback_url: callbackUrl,
        enable_wait_for_connections: false,
      },
    }),
  })
  const sessionId = getSessionId(session)
  if (!sessionId) throw Object.assign(new Error('Composio did not return a connection session.'), { status: 502, code: 'session_id_missing' })

  const link = await composioRequest(`/tool_router/session/${encodeURIComponent(sessionId)}/link`, {
    method: 'POST',
    body: JSON.stringify({
      toolkit: definition.toolkit,
      alias: `freetrust-${provider}-${userId.slice(0, 8)}`,
      callback_url: callbackUrl,
    }),
  })
  const connectedAccountId = getConnectedAccountId(link)
  const redirectUrl = getRedirectUrl(link)
  if (!redirectUrl) throw Object.assign(new Error('Composio did not return a connection link.'), { status: 502, code: 'redirect_url_missing' })

  const admin = createAdminClient()
  const { error } = await admin.from('member_integrations').upsert({
    user_id: userId,
    provider,
    toolkit: definition.toolkit,
    status: 'pending',
    external_account_name: definition.name,
    encrypted_connection_state: encryptConnectionState({
      sessionId,
      connectedAccountId: connectedAccountId ?? null,
      userId,
      provider,
    }),
    metadata: { integration_mode: 'composio', toolkit: definition.toolkit },
    last_error_code: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,provider' })
  if (error) throw new Error(error.message)

  return { redirectUrl, provider, status: 'pending' as const }
}

export async function disconnectMemberComposioIntegration(userId: string, provider: ComposioProvider) {
  const definition = getComposioProvider(provider)
  if (!definition) throw Object.assign(new Error('Unsupported integration provider.'), { status: 400, code: 'unsupported_provider' })
  const rows = await listRows(userId)
  const row = rows.find((item) => item.provider === provider)
  const state = row ? decryptConnectionState(row.encrypted_connection_state) : null

  if (state?.connectedAccountId) {
    try {
      await composioRequest(`/connected_accounts/${encodeURIComponent(state.connectedAccountId)}`, { method: 'DELETE' })
    } catch (error) {
      // A provider may already have revoked the connection. The FreeTrust
      // reference is still cleared so no future member action can use it.
      if ((error as IntegrationError).status !== 404) console.warn('[Composio] remote disconnect failed:', error)
    }
  }

  if (row) {
    await patchRow(userId, provider, {
      status: 'disconnected',
      external_account_name: null,
      encrypted_connection_state: null,
      last_error_code: null,
      last_verified_at: null,
    })
  }
  return { provider, status: 'disconnected' as const }
}

export function composioErrorResponse(error: unknown) {
  const typed = error as IntegrationError
  return {
    status: typed.status && typed.status >= 400 && typed.status < 600 ? typed.status : 500,
    body: {
      success: false,
      error: typed.code ?? 'composio_integration_failed',
      message: typed.message ?? 'Integration request failed.',
    },
  }
}
