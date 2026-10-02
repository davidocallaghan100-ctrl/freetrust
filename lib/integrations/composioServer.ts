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

export type ComposioAgentTool = {
  provider: ComposioProvider
  providerName: string
  toolSlug: string
  version: string
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export type ComposioAgentToolRun = {
  provider: ComposioProvider
  providerName: string
  toolSlug: string
  name: string
}

type ComposioAgentToolConfig = {
  provider: ComposioProvider
  toolSlug: string
  description: string
}

// Keep the first agent integration surface deliberately read-only. External
// writes remain out of the model tool loop and continue through the existing
// human-reviewed FreeTrust action cards.
const COMPOSIO_AGENT_TOOL_CATALOG: ComposioAgentToolConfig[] = [
  {
    provider: 'hubspot',
    toolSlug: 'HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA',
    description: 'Search the member-owned HubSpot CRM for contacts, companies, deals, tickets, or other CRM records.',
  },
  {
    provider: 'salesforce',
    toolSlug: 'SALESFORCE_SEARCH_CONTACTS',
    description: 'Search the member-owned Salesforce contacts using a name, email, phone, account, or title.',
  },
  {
    provider: 'outlook',
    toolSlug: 'OUTLOOK_LIST_MESSAGES',
    description: 'Search the member-owned Microsoft mailbox for relevant messages using metadata and short previews.',
  },
  {
    provider: 'whatsapp',
    toolSlug: 'WHATSAPP_GET_MESSAGE_HISTORY',
    description: 'Read delivery history for the member-owned WhatsApp Business messages.',
  },
  {
    provider: 'linkedin',
    toolSlug: 'LINKEDIN_GET_MY_INFO',
    description: 'Read the connected member-owned LinkedIn profile information.',
  },
  {
    provider: 'instagram',
    toolSlug: 'INSTAGRAM_GET_USER_INFO',
    description: 'Read the connected member-owned Instagram Business or Creator profile information.',
  },
]

const composioAgentToolSchemaCache = new Map<string, Promise<ComposioAgentTool>>()

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

function objectFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function connectionStateForUser(userId: string, row: StoredIntegration) {
  const state = decryptConnectionState(row.encrypted_connection_state)
  if (!state || state.userId !== userId || state.provider !== row.provider || !state.connectedAccountId) return null
  return state
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

function normaliseAgentToolArguments(toolSlug: string, raw: unknown): Record<string, unknown> {
  const input = objectFrom(raw) ? { ...(raw as Record<string, unknown>) } : {}
  if (toolSlug === 'HUBSPOT_SEARCH_CRM_OBJECTS_BY_CRITERIA') {
    const objectType = typeof input.objectType === 'string' && input.objectType.trim() ? input.objectType.trim().toLowerCase() : 'contacts'
    const safeObjectTypes = new Set(['contacts', 'companies', 'deals', 'tickets', 'tasks', 'products', 'quotes', 'meetings', 'notes'])
    input.objectType = safeObjectTypes.has(objectType) ? objectType : 'contacts'
    input.limit = clampInteger(input.limit, 10, 1, 20)
    if (!Array.isArray(input.properties)) input.properties = input.objectType === 'contacts' ? ['firstname', 'lastname', 'email', 'phone', 'company', 'jobtitle'] : input.objectType === 'companies' ? ['name', 'domain', 'industry', 'phone'] : undefined
  }
  if (toolSlug === 'SALESFORCE_SEARCH_CONTACTS') {
    input.limit = clampInteger(input.limit, 10, 1, 20)
    if (typeof input.fields !== 'string' || !input.fields.trim()) input.fields = 'Id,Name,FirstName,LastName,Email,Phone,Title,AccountId,Account.Name'
  }
  if (toolSlug === 'OUTLOOK_LIST_MESSAGES') {
    input.top = clampInteger(input.top, 10, 1, 10)
    input.user_id = 'me'
    input.response_detail = 'minimal'
    if (!Array.isArray(input.select) || input.select.length === 0) input.select = ['id', 'subject', 'from', 'receivedDateTime', 'bodyPreview', 'isRead', 'hasAttachments']
  }
  if (toolSlug === 'WHATSAPP_GET_MESSAGE_HISTORY') {
    input.limit = clampInteger(input.limit, 25, 1, 25)
    if (typeof input.fields !== 'string' || !input.fields.trim()) input.fields = 'id,message_id,events{delivery_status,timestamp,error_description}'
  }
  if (toolSlug === 'LINKEDIN_GET_MY_INFO') return {}
  if (toolSlug === 'INSTAGRAM_GET_USER_INFO') {
    input.ig_user_id = 'me'
    input.fields = 'id,name,username,biography,account_type,followers_count,follows_count,media_count,profile_picture_url'
  }
  return input
}

async function getComposioAgentToolSchema(config: ComposioAgentToolConfig): Promise<ComposioAgentTool> {
  const existing = composioAgentToolSchemaCache.get(config.toolSlug)
  if (existing) return existing
  const pending = (async () => {
    const definition = getComposioProvider(config.provider)
    if (!definition) throw Object.assign(new Error('Unsupported integration provider.'), { status: 400, code: 'unsupported_provider' })
    const data = composioPayload(await composioRequest(`/tools/${encodeURIComponent(config.toolSlug)}?version=latest`))
    const tool = data.tool && typeof data.tool === 'object' ? data.tool as Record<string, unknown> : data
    const inputSchema = objectFrom(tool.input_parameters) ?? objectFrom(tool.inputParameters) ?? objectFrom(tool.input_schema) ?? objectFrom(tool.inputSchema)
    if (!inputSchema) throw Object.assign(new Error(`Composio did not return an input schema for ${config.toolSlug}.`), { status: 502, code: 'tool_schema_missing' })
    return {
      provider: config.provider,
      providerName: definition.name,
      toolSlug: config.toolSlug,
      version: typeof tool.version === 'string' && tool.version.trim() ? tool.version : 'latest',
      name: typeof tool.name === 'string' && tool.name.trim() ? tool.name : config.toolSlug,
      description: `${config.description} ${typeof tool.description === 'string' ? tool.description : ''}`.trim().slice(0, 1_800),
      inputSchema,
    }
  })()
  composioAgentToolSchemaCache.set(config.toolSlug, pending)
  try {
    return await pending
  } catch (error) {
    composioAgentToolSchemaCache.delete(config.toolSlug)
    throw error
  }
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

export async function getMemberComposioAgentTools(userId: string): Promise<ComposioAgentTool[]> {
  const rows = await listRows(userId)
  const byProvider = new Map(rows.map((row) => [row.provider, row]))
  const tools: ComposioAgentTool[] = []

  for (const config of COMPOSIO_AGENT_TOOL_CATALOG) {
    const row = byProvider.get(config.provider)
    if (!row || row.status === 'disconnected') continue

    let refreshed = row
    try {
      refreshed = await refreshRow(userId, row)
    } catch (error) {
      console.warn(`[Composio] Could not refresh ${config.provider} for agent context:`, error)
      continue
    }

    if (refreshed.status !== 'active' || !connectionStateForUser(userId, refreshed)) continue

    try {
      tools.push(await getComposioAgentToolSchema(config))
    } catch (error) {
      console.warn(`[Composio] Could not load ${config.toolSlug} schema:`, error)
    }
  }

  return tools
}

export async function executeMemberComposioAgentTool(userId: string, toolSlug: string, rawArguments: unknown) {
  const config = COMPOSIO_AGENT_TOOL_CATALOG.find((item) => item.toolSlug === toolSlug)
  if (!config) {
    throw Object.assign(new Error('This integration action is not enabled for FreeTrust Agents.'), {
      status: 400,
      code: 'agent_tool_not_allowed',
    })
  }

  const row = (await listRows(userId)).find((item) => item.provider === config.provider)
  if (!row) {
    throw Object.assign(new Error(`Connect ${getComposioProvider(config.provider)?.name ?? config.provider} before using it with an agent.`), {
      status: 409,
      code: 'integration_not_connected',
    })
  }

  const refreshed = await refreshRow(userId, row)
  if (refreshed.status !== 'active') {
    throw Object.assign(new Error(`The ${getComposioProvider(config.provider)?.name ?? config.provider} connection is not active.`), {
      status: 409,
      code: 'integration_not_active',
    })
  }

  const state = connectionStateForUser(userId, refreshed)
  if (!state) {
    throw Object.assign(new Error('The connected account reference could not be verified.'), {
      status: 409,
      code: 'integration_state_invalid',
    })
  }

  const tool = await getComposioAgentToolSchema(config)
  const remote = await composioRequest(`/tools/execute/${encodeURIComponent(tool.toolSlug)}`, {
    method: 'POST',
    body: JSON.stringify({
      connected_account_id: state.connectedAccountId,
      user_id: userId,
      version: tool.version,
      arguments: normaliseAgentToolArguments(tool.toolSlug, rawArguments),
    }),
  })

  if (remote.successful === false) {
    throw Object.assign(new Error(cleanError(remote.error ?? remote, `${tool.name} failed.`)), {
      status: 502,
      code: 'composio_tool_failed',
    })
  }

  return {
    data: remote.data ?? remote,
    run: {
      provider: tool.provider,
      providerName: tool.providerName,
      toolSlug: tool.toolSlug,
      name: tool.name,
    } satisfies ComposioAgentToolRun,
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
