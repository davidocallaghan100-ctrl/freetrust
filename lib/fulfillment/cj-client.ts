/** Server-only, read-only CJ Dropshipping client for catalogue discovery. */
import 'server-only'

const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1'
const REQUEST_TIMEOUT_MS = 15_000
const TOKEN_REFRESH_BUFFER_MS = 60_000
const MIN_CJ_CALL_INTERVAL_MS = 1_100

type CjEnvelope<T> = {
  code?: number
  result?: boolean
  success?: boolean
  message?: string
  data?: T
  requestId?: string
}

type CachedToken = {
  accessToken: string
  accessTokenExpiresAt: number
  refreshToken: string | null
  refreshTokenExpiresAt: number
}

let nextCallAt = 0
let requestQueue: Promise<void> = Promise.resolve()
const tokenCache = new Map<string, CachedToken>()
const tokenRequests = new Map<string, Promise<string>>()

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

async function acquireCallSlot(sleep: (milliseconds: number) => Promise<void>, now: () => number) {
  const scheduled = requestQueue.then(async () => {
    const wait = Math.max(0, nextCallAt - now())
    if (wait > 0) await sleep(wait)
    nextCallAt = now() + MIN_CJ_CALL_INTERVAL_MS
  })
  requestQueue = scheduled.catch(() => undefined)
  await scheduled
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function isSuccessful<T>(value: unknown): value is CjEnvelope<T> {
  if (!isObject(value)) return false
  const envelope = value as CjEnvelope<T>
  return envelope.code === 200 && envelope.result !== false && envelope.success !== false
}

function integer(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

function assertCjId(value: string, label: string) {
  if (!/^[A-Za-z0-9-]{1,64}$/.test(value)) throw new Error(`${label} is invalid`)
}

export class CjApiError extends Error {
  readonly code: number | null
  readonly requestId: string | null

  constructor(message: string, code: number | null = null, requestId: string | null = null) {
    super(message)
    this.name = 'CjApiError'
    this.code = code
    this.requestId = requestId
  }
}

export type CjProductSummary = {
  id?: string
  nameEn?: string
  sku?: string
  bigImage?: string
  threeCategoryName?: string
  sellPrice?: string | number
  nowPrice?: string | number
  saleStatus?: string | number
  productType?: string
  totalVerifiedInventory?: number | string
  verifiedWarehouse?: number | string
}

type ProductSearchPage = {
  pageNumber?: number
  totalPages?: number
  content?: Array<{ productList?: CjProductSummary[] }>
}

export type CjProductVariant = {
  vid?: string
  variantNameEn?: string | null
  variantSku?: string | null
  variantImage?: string | null
  variantKey?: string | null
  variantStandard?: string | null
  variantWeight?: number | string | null
  variantVolume?: number | string | null
  variantSellPrice?: number | string | null
  variantLength?: number | string | null
  variantWidth?: number | string | null
  variantHeight?: number | string | null
}

export type CjProductDetails = {
  pid?: string
  productNameEn?: string
  productSku?: string
  bigImage?: string
  productImageSet?: string[]
  sellPrice?: number | string
  productWeight?: number | string
  packingWeight?: number | string
  productProEnSet?: string[] | string
  status?: string | number
  saleStatus?: string | number
  variants?: CjProductVariant[]
}

export type CjProductInventory = {
  variantInventories?: Array<{
    vid?: string
    inventory?: Array<{
      countryCode?: string
      verifiedWarehouse?: string | number
      cjInventory?: string | number
      totalInventory?: string | number
      factoryInventory?: string | number
    }>
  }>
}

export type VerifiedVariantStock = {
  variantId: string
  warehouses: Array<{ countryCode: string | null; quantity: number }>
  totalVerifiedQuantity: number
}

export type CjFreightInput = {
  startCountryCode: string
  endCountryCode: string
  zip?: string
  variantId: string
  sku: string
  quantity: number
  /** Per-unit variantWeight in grams from CJ product details. */
  weightGrams: number
  /** Per-unit packingWeight in grams from CJ product details. */
  wrapWeightGrams: number
  /** Per-unit variantVolume in mm³ from CJ product details. */
  volumeMm3: number
  productProperties: string[]
}

export type CjFreightQuote = {
  arrivalTime?: string | null
  discountFee?: number | string | null
  wrapPostage?: number | string | null
  taxesFee?: number | string | null
  clearanceOperationFee?: number | string | null
  tariff?: number | string | null
  totalPostageFee?: number | string | null
  option?: { enName?: string; id?: string } | null
  channel?: { enName?: string; id?: string } | null
  errorEn?: string | null
}

type ClientOptions = {
  apiKey?: string
  fetchImpl?: typeof fetch
  now?: () => number
  sleep?: (milliseconds: number) => Promise<void>
}

/** Factory inventory and unverified warehouse quantities are excluded. */
export function verifiedStockByVariant(data: CjProductInventory): VerifiedVariantStock[] {
  const variants = Array.isArray(data?.variantInventories) ? data.variantInventories : []
  return variants.flatMap((variant) => {
    if (typeof variant?.vid !== 'string' || !variant.vid) return []
    const warehouses = (Array.isArray(variant.inventory) ? variant.inventory : [])
      .filter((warehouse) => Number(warehouse?.verifiedWarehouse) === 1)
      .map((warehouse) => ({
        countryCode: typeof warehouse.countryCode === 'string' ? warehouse.countryCode : null,
        quantity: integer(warehouse.cjInventory),
      }))
      .filter((warehouse) => warehouse.quantity > 0)
    if (!warehouses.length) return []
    return [{
      variantId: variant.vid,
      warehouses,
      totalVerifiedQuantity: warehouses.reduce((sum, warehouse) => sum + warehouse.quantity, 0),
    }]
  })
}

export class CjDropshippingClient {
  private readonly apiKey: string
  private readonly fetchImpl: typeof fetch
  private readonly now: () => number
  private readonly sleep: (milliseconds: number) => Promise<void>

  constructor(options: ClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.CJ_API_KEY ?? ''
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? Date.now
    this.sleep = options.sleep ?? delay
  }

  private async parseTokenResponse(response: Response, fallback?: CachedToken): Promise<string> {
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new CjApiError('CJ authentication returned an invalid response')
    }
    if (!response.ok || !isSuccessful<{ accessToken?: unknown; accessTokenExpiryDate?: unknown; refreshToken?: unknown; refreshTokenExpiryDate?: unknown }>(payload)) {
      const envelope = isObject(payload) ? payload as CjEnvelope<unknown> : null
      throw new CjApiError('CJ authentication was rejected', typeof envelope?.code === 'number' ? envelope.code : null, typeof envelope?.requestId === 'string' ? envelope.requestId : null)
    }
    const data = payload.data
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken : ''
    const accessExpiry = typeof data?.accessTokenExpiryDate === 'string' ? Date.parse(data.accessTokenExpiryDate) : Number.NaN
    const refreshToken = typeof data?.refreshToken === 'string' ? data.refreshToken : fallback?.refreshToken ?? null
    const refreshExpiry = typeof data?.refreshTokenExpiryDate === 'string' ? Date.parse(data.refreshTokenExpiryDate) : fallback?.refreshTokenExpiresAt ?? 0
    if (!accessToken || !Number.isFinite(accessExpiry) || accessExpiry <= this.now()) {
      throw new CjApiError('CJ authentication response did not include a valid access token')
    }
    tokenCache.set(this.apiKey, {
      accessToken,
      accessTokenExpiresAt: accessExpiry,
      refreshToken,
      refreshTokenExpiresAt: Number.isFinite(refreshExpiry) ? refreshExpiry : 0,
    })
    return accessToken
  }

  private async fetchToken(cached?: CachedToken): Promise<string> {
    const refreshing = Boolean(cached?.refreshToken && cached.refreshTokenExpiresAt > this.now() + TOKEN_REFRESH_BUFFER_MS)
    const url = `${CJ_API_BASE}/authentication/${refreshing ? 'refreshAccessToken' : 'getAccessToken'}`
    const body = refreshing ? { refreshToken: cached!.refreshToken } : { apiKey: this.apiKey }
    let response: Response
    try {
      await acquireCallSlot(this.sleep, this.now)
      response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new CjApiError('CJ authentication request failed')
    }
    return this.parseTokenResponse(response, cached)
  }

  private async getAccessToken(): Promise<string> {
    if (!this.apiKey) throw new CjApiError('CJ_API_KEY is not configured')
    const cached = tokenCache.get(this.apiKey)
    if (cached?.accessToken && cached.accessTokenExpiresAt > this.now() + TOKEN_REFRESH_BUFFER_MS) return cached.accessToken
    const pending = tokenRequests.get(this.apiKey)
    if (pending) return pending
    const request = this.fetchToken(cached)
    tokenRequests.set(this.apiKey, request)
    try {
      return await request
    } finally {
      if (tokenRequests.get(this.apiKey) === request) tokenRequests.delete(this.apiKey)
    }
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken()
    let response: Response
    try {
      await acquireCallSlot(this.sleep, this.now)
      response = await this.fetchImpl(`${CJ_API_BASE}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...init.headers,
          'CJ-Access-Token': token,
        },
        cache: 'no-store',
        signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new CjApiError('CJ API request failed')
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new CjApiError('CJ API returned an invalid response')
    }
    if (!response.ok || !isSuccessful<T>(payload)) {
      const envelope = isObject(payload) ? payload as CjEnvelope<unknown> : null
      throw new CjApiError('CJ API request was rejected', typeof envelope?.code === 'number' ? envelope.code : null, typeof envelope?.requestId === 'string' ? envelope.requestId : null)
    }
    return payload.data as T
  }

  async searchProducts(query: string, page = 1, size = 10) {
    const keyword = query.trim()
    if (keyword.length < 2 || keyword.length > 100) throw new Error('Search query must be between 2 and 100 characters')
    if (!Number.isInteger(page) || page < 1 || page > 1000) throw new Error('Page must be between 1 and 1000')
    if (!Number.isInteger(size) || size < 1 || size > 20) throw new Error('Page size must be between 1 and 20')
    const params = new URLSearchParams({ keyWord: keyword, page: String(page), size: String(size), productType: '4', verifiedWarehouse: '1', startWarehouseInventory: '1' })
    const data = await this.request<ProductSearchPage>(`/product/listV2?${params.toString()}`)
    const groups = Array.isArray(data.content) ? data.content : []
    return {
      pageNumber: typeof data.pageNumber === 'number' ? data.pageNumber : page,
      totalPages: typeof data.totalPages === 'number' ? data.totalPages : 0,
      products: groups.flatMap((group) => Array.isArray(group?.productList) ? group.productList : []),
    }
  }

  async getProductDetails(productId: string): Promise<CjProductDetails> {
    assertCjId(productId, 'Product ID')
    const params = new URLSearchParams({ pid: productId })
    return this.request<CjProductDetails>(`/product/query?${params.toString()}`)
  }

  async getProductInventory(productId: string): Promise<CjProductInventory> {
    assertCjId(productId, 'Product ID')
    const params = new URLSearchParams({ pid: productId })
    return this.request<CjProductInventory>(`/product/stock/getInventoryByPid?${params.toString()}`)
  }

  async calculateFreight(input: CjFreightInput): Promise<CjFreightQuote[]> {
    const start = input.startCountryCode.toUpperCase()
    const end = input.endCountryCode.toUpperCase()
    if (!/^[A-Z]{2}$/.test(start) || !/^[A-Z]{2}$/.test(end)) throw new Error('Country codes must be two-letter ISO codes')
    assertCjId(input.variantId, 'Variant ID')
    const sku = input.sku.trim()
    if (!sku || sku.length > 100) throw new Error('A valid CJ variant SKU is required')
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 50) throw new Error('Variant quantity must be between 1 and 50')
    if (!Number.isFinite(input.weightGrams) || input.weightGrams <= 0) throw new Error('CJ variant weight must be positive')
    if (!Number.isFinite(input.wrapWeightGrams) || input.wrapWeightGrams <= 0) throw new Error('CJ packed weight must be positive')
    if (!Number.isFinite(input.volumeMm3) || input.volumeMm3 <= 0) throw new Error('CJ variant volume must be positive')
    const properties = Array.isArray(input.productProperties) ? input.productProperties.map((property) => property.trim()).filter(Boolean) : []
    if (!properties.length || properties.some((property) => property.length > 100)) throw new Error('CJ product logistics properties are required')
    const volumeCm3PerUnit = input.volumeMm3 / 1000

    const data = await this.request<unknown>('/logistic/freightCalculateTip', {
      method: 'POST',
      body: JSON.stringify({
        reqDTOS: [{
          srcAreaCode: start,
          destAreaCode: end,
          ...(input.zip ? { zip: input.zip.trim().slice(0, 20) } : {}),
          weight: Math.ceil(input.weightGrams * input.quantity),
          wrapWeight: Math.ceil(input.wrapWeightGrams * input.quantity),
          volume: volumeCm3PerUnit * input.quantity,
          productProp: properties,
          productTypes: ['4'],
          skuList: [sku],
          freightTrialSkuList: [{ vid: input.variantId, sku, skuQuantity: input.quantity, skuWeight: input.weightGrams, skuVolume: volumeCm3PerUnit, productTypeList: ['4'], productPropList: properties }],
        }],
      }),
    })
    return Array.isArray(data) ? data.filter(isObject) as CjFreightQuote[] : []
  }
}
