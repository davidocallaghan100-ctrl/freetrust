import { randomUUID } from 'node:crypto'

type PayPalEnvironment = 'sandbox' | 'live'

export type PayPalOrder = {
  id: string
  status?: string
  links?: Array<{ href: string; rel: string; method?: string }>
  purchase_units?: Array<{
    reference_id?: string
    custom_id?: string
    amount?: { currency_code?: string; value?: string }
    payments?: {
      authorizations?: Array<{
        id: string
        status?: string
        amount?: { currency_code?: string; value?: string }
      }>
      captures?: Array<{
        id: string
        status?: string
        amount?: { currency_code?: string; value?: string }
      }>
    }
  }>
}

export type PayPalPayout = {
  batch_header?: {
    payout_batch_id?: string
    batch_status?: string
  }
  items?: Array<{
    payout_item_id?: string
    transaction_status?: string
    errors?: { name?: string; message?: string }
  }>
}

const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
const environment: PayPalEnvironment = process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox'
const apiBase = environment === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

let cachedToken: { value: string; expiresAt: number } | null = null

export function isPayPalConfigured() {
  return Boolean(clientId && clientSecret)
}

function isProductionDeployment() {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production'
  return process.env.NODE_ENV === 'production'
}

// Never expose or accept sandbox PayPal payments from the production app.
// Vercel previews may use sandbox credentials; production requires live
// credentials and PayPal's live-access approval.
export function isPayPalAvailable() {
  const productionEnabled = process.env.PAYPAL_PRODUCTION_ENABLED === 'true'
    || process.env.PAYPAL_LIVE_TEST_ENABLED === 'true'
  return isPayPalConfigured() && (!isProductionDeployment() || (environment === 'live' && productionEnabled))
}

// Keep wallet funding/cash-out behind its own production switch. The
// temporary live-smoke-test flag must not accidentally expose wallet PayPal
// payments to every member while the one-off admin test is enabled.
export function isPayPalWalletAvailable() {
  return isPayPalAvailable() && (!isProductionDeployment() || process.env.PAYPAL_WALLET_ENABLED === 'true')
}

export function getPayPalEnvironment() {
  return environment
}

async function getAccessToken() {
  if (!isPayPalConfigured()) throw new Error('PayPal is not configured')
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value

  const response = await fetch(`${apiBase}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || `PayPal authentication failed (${response.status})`)
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, Number(payload.expires_in ?? 900)) * 1000,
  }
  return payload.access_token
}

async function paypalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/json')
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({})) as T & { name?: string; message?: string; details?: Array<{ issue?: string; description?: string }> }
  if (!response.ok) {
    const detail = payload.details?.map(item => item.description || item.issue).filter(Boolean).join('; ')
    throw new Error(detail || payload.message || `PayPal request failed (${response.status})`)
  }
  return payload
}

export async function createPayPalOrder(input: {
  referenceId: string
  customId: string
  description: string
  amountCents: number
  returnUrl: string
  cancelUrl: string
  intent?: 'AUTHORIZE' | 'CAPTURE'
  requestId?: string
}) {
  const value = (input.amountCents / 100).toFixed(2)
  return paypalRequest<PayPalOrder>('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': input.requestId ?? `freetrust-${input.referenceId}-${randomUUID()}` },
    body: JSON.stringify({
      intent: input.intent ?? 'AUTHORIZE',
      purchase_units: [{
        reference_id: input.referenceId,
        custom_id: input.customId,
        description: input.description.slice(0, 127),
        amount: { currency_code: 'EUR', value },
      }],
      application_context: {
        brand_name: 'FreeTrust',
        landing_page: 'LOGIN',
        user_action: 'PAY_NOW',
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
      },
    }),
  })
}

export function getPayPalApprovalUrl(order: PayPalOrder) {
  return order.links?.find(link => link.rel === 'approve')?.href ?? null
}

export function getPayPalAuthorizationId(order: PayPalOrder) {
  return order.purchase_units?.[0]?.payments?.authorizations?.[0]?.id ?? null
}

export function getPayPalCaptureId(order: PayPalOrder) {
  return order.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null
}

export async function getPayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`)
}

export async function authorizePayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `freetrust-authorize-${orderId}` },
    body: JSON.stringify({}),
  })
}

export async function capturePayPalOrder(orderId: string) {
  return paypalRequest<PayPalOrder>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `freetrust-order-capture-${orderId}` },
    body: JSON.stringify({}),
  })
}

export async function capturePayPalAuthorization(authorizationId: string) {
  return paypalRequest<{ id: string; status?: string; amount?: { currency_code?: string; value?: string } }>(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `freetrust-capture-${authorizationId}` },
      body: JSON.stringify({}),
    },
  )
}

export async function voidPayPalAuthorization(authorizationId: string) {
  return paypalRequest<Record<string, never>>(
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
    {
      method: 'POST',
      headers: { 'PayPal-Request-Id': `freetrust-void-${authorizationId}` },
      body: JSON.stringify({}),
    },
  )
}

export async function sendPayPalPayout(input: {
  orderId: string
  recipientEmail: string
  amountCents: number
  note: string
}) {
  const value = (input.amountCents / 100).toFixed(2)
  return paypalRequest<PayPalPayout>('/v1/payments/payouts', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': `freetrust-payout-${input.orderId}` },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: `freetrust-${input.orderId}`,
        email_subject: 'You have a FreeTrust payout',
        email_message: 'FreeTrust has released your marketplace payment.',
      },
      items: [{
        recipient_type: 'EMAIL',
        amount: { value, currency: 'EUR' },
        receiver: input.recipientEmail,
        note: input.note.slice(0, 400),
        sender_item_id: input.orderId,
      }],
    }),
  })
}

export async function getPayPalPayoutBatch(batchId: string) {
  return paypalRequest<PayPalPayout>(`/v1/payments/payouts/${encodeURIComponent(batchId)}`)
}
