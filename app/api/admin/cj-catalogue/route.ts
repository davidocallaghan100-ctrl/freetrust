import { NextRequest, NextResponse } from 'next/server'
import { requireFreeTrustAdmin } from '@/lib/admin/access'
import { CjApiError, CjDropshippingClient, verifiedStockByVariant } from '@/lib/fulfillment/cj-client'
import type { CjFreightQuote, CjProductDetails, CjProductVariant, CjProductSummary } from '@/lib/fulfillment/cj-client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const cjClient = new CjDropshippingClient()
const noStore = { headers: { 'Cache-Control': 'no-store, private' } }

function safeSummary(product: CjProductSummary) {
  return {
    id: typeof product.id === 'string' ? product.id : null,
    title: typeof product.nameEn === 'string' ? product.nameEn : null,
    sku: typeof product.sku === 'string' ? product.sku : null,
    imageUrl: typeof product.bigImage === 'string' ? product.bigImage : null,
    category: typeof product.threeCategoryName === 'string' ? product.threeCategoryName : null,
    supplierPriceUsd: product.nowPrice ?? product.sellPrice ?? null,
    verifiedInventoryReported: Number(product.totalVerifiedInventory ?? 0) || 0,
  }
}

function positiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

function productProperties(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  if (typeof value !== 'string' || !value.trim()) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  } catch {
    // Some CJ products provide the English logistics property as a plain string.
  }
  return [value.trim()]
}

function normalizeProduct(details: CjProductDetails, inventory: Awaited<ReturnType<CjDropshippingClient['getProductInventory']>>) {
  const stockById = new Map(verifiedStockByVariant(inventory).map((stock) => [stock.variantId, stock]))
  const variants = (Array.isArray(details.variants) ? details.variants : [])
    .filter((variant): variant is CjProductVariant => Boolean(variant && typeof variant.vid === 'string'))
    .map((variant) => {
      const stock = stockById.get(variant.vid!)
      return {
        id: variant.vid!,
        name: variant.variantNameEn || variant.variantKey || variant.variantStandard || variant.variantSku || 'CJ variant',
        sku: typeof variant.variantSku === 'string' ? variant.variantSku : null,
        imageUrl: typeof variant.variantImage === 'string' ? variant.variantImage : null,
        priceUsd: positiveNumber(variant.variantSellPrice),
        weightGrams: positiveNumber(variant.variantWeight),
        volumeMm3: positiveNumber(variant.variantVolume),
        lengthMm: positiveNumber(variant.variantLength),
        widthMm: positiveNumber(variant.variantWidth),
        heightMm: positiveNumber(variant.variantHeight),
        warehouses: stock?.warehouses ?? [],
        totalVerifiedQuantity: stock?.totalVerifiedQuantity ?? 0,
      }
    })

  return {
    id: typeof details.pid === 'string' ? details.pid : null,
    title: typeof details.productNameEn === 'string' ? details.productNameEn : null,
    sku: typeof details.productSku === 'string' ? details.productSku : null,
    imageUrl: typeof details.bigImage === 'string' ? details.bigImage : null,
    images: Array.isArray(details.productImageSet) ? details.productImageSet.filter((image) => typeof image === 'string') : [],
    supplierPriceUsd: positiveNumber(details.sellPrice),
    packedWeightGrams: positiveNumber(details.packingWeight),
    productProperties: productProperties(details.productProEnSet),
    variants,
  }
}

function moneyToUsdCents(value: unknown, missingMeansZero = false): number | null {
  if (value === null || value === undefined || value === '') return missingMeansZero ? 0 : null
  const amount = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 0) return null
  const cents = Math.round(amount * 100)
  return Number.isSafeInteger(cents) ? cents : null
}

function normalizeFreightQuote(quote: CjFreightQuote) {
  const postageUsdCents = moneyToUsdCents(quote.wrapPostage ?? quote.discountFee)
  const taxesUsdCents = moneyToUsdCents(quote.taxesFee, true)
  const clearanceUsdCents = moneyToUsdCents(quote.clearanceOperationFee, true)
  const tariffUsdCents = moneyToUsdCents(quote.tariff, true)
  const components = [postageUsdCents, taxesUsdCents, clearanceUsdCents, tariffUsdCents]
  const totalPostageUsdCents = moneyToUsdCents(quote.totalPostageFee)
    ?? (components.every(Number.isSafeInteger)
    ? (postageUsdCents as number) + (taxesUsdCents as number) + (clearanceUsdCents as number) + (tariffUsdCents as number)
    : null)
  return {
    logisticsName: quote.option?.enName ?? quote.channel?.enName ?? null,
    arrivalTime: quote.arrivalTime ?? null,
    postageUsdCents,
    taxesUsdCents,
    clearanceOperationUsdCents: clearanceUsdCents,
    tariffUsdCents,
    totalPostageUsdCents,
    error: typeof quote.errorEn === 'string' && quote.errorEn ? quote.errorEn : null,
  }
}

function logCjError(label: string, error: unknown) {
  if (error instanceof CjApiError) {
    console.error(label, { code: error.code, requestId: error.requestId, message: error.message })
  } else {
    console.error(label, error instanceof Error ? error.message : 'Unknown error')
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response
  if (!process.env.CJ_API_KEY) return NextResponse.json({ error: 'CJ supplier API is not configured' }, { status: 503, ...noStore })

  const productId = request.nextUrl.searchParams.get('productId')?.trim()
  try {
    if (productId) {
      const [details, inventory] = await Promise.all([
        cjClient.getProductDetails(productId),
        cjClient.getProductInventory(productId),
      ])
      if (details.pid !== productId) return NextResponse.json({ error: 'CJ product was not found' }, { status: 404, ...noStore })
      return NextResponse.json({
        product: normalizeProduct(details, inventory),
        checkedAt: new Date().toISOString(),
        note: 'Variant prices/specifications come from CJ product details. Stock shown is positive inventory in verified CJ-managed warehouses only.',
      }, noStore)
    }

    const query = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    const pageValue = Number(request.nextUrl.searchParams.get('page') ?? '1')
    const page = Number.isInteger(pageValue) ? pageValue : 1
    if (query.length < 2 || query.length > 100 || page < 1 || page > 1000) {
      return NextResponse.json({ error: 'Provide a 2–100 character search query and valid page number' }, { status: 400, ...noStore })
    }
    const result = await cjClient.searchProducts(query, page, 10)
    const products = result.products
      .filter((product): product is CjProductSummary => Boolean(product && typeof product === 'object'))
      .filter((product) => String(product.saleStatus) === '3'
        && Number(product.verifiedWarehouse) === 1
        && Number(product.totalVerifiedInventory ?? 0) > 0)
      .map(safeSummary)
    return NextResponse.json({
      query,
      page: result.pageNumber,
      totalPages: result.totalPages,
      products,
      note: 'Admin-only supplier discovery. Inspect a product’s real variant details and verified stock, then request an Ireland freight estimate before any catalogue decision.',
    }, noStore)
  } catch (error) {
    logCjError('[admin/cj-catalogue]', error)
    return NextResponse.json({ error: 'CJ supplier catalogue request failed' }, { status: 502, ...noStore })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response
  if (!process.env.CJ_API_KEY) return NextResponse.json({ error: 'CJ supplier API is not configured' }, { status: 503, ...noStore })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, ...noStore })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid quote request' }, { status: 400, ...noStore })
  const input = body as Record<string, unknown>
  const productId = typeof input.productId === 'string' ? input.productId.trim() : ''
  const variantId = typeof input.variantId === 'string' ? input.variantId.trim() : ''
  const originCountryCode = typeof input.originCountryCode === 'string' ? input.originCountryCode.trim().toUpperCase() : ''
  const quantity = input.quantity === undefined ? 1 : Number(input.quantity)
  const zip = typeof input.zip === 'string' ? input.zip.trim().slice(0, 20) : undefined
  if (!productId || !variantId || !/^[A-Z]{2}$/.test(originCountryCode)
    || !Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    return NextResponse.json({ error: 'Provide a product, variant, verified stock origin, and quantity from 1 to 50' }, { status: 400, ...noStore })
  }

  try {
    const [details, inventory] = await Promise.all([
      cjClient.getProductDetails(productId),
      cjClient.getProductInventory(productId),
    ])
    if (details.pid !== productId) return NextResponse.json({ error: 'CJ product was not found' }, { status: 404, ...noStore })
    const status = details.saleStatus ?? details.status
    if (String(status) !== '3') return NextResponse.json({ error: 'CJ no longer reports this product as on sale' }, { status: 409, ...noStore })
    const variant = (Array.isArray(details.variants) ? details.variants : []).find((item) => item?.vid === variantId)
    const stock = verifiedStockByVariant(inventory).find((item) => item.variantId === variantId)
    const warehouse = stock?.warehouses.find((item) => item.countryCode === originCountryCode)
    if (!variant || !variant.variantSku || !warehouse || warehouse.quantity < quantity) {
      return NextResponse.json({ error: 'Selected variant does not have enough current verified CJ-managed stock at that origin' }, { status: 409, ...noStore })
    }

    const weightGrams = positiveNumber(variant.variantWeight)
    const wrapWeightGrams = positiveNumber(details.packingWeight)
    const volume = positiveNumber(variant.variantVolume)
    const properties = productProperties(details.productProEnSet)
    if (!weightGrams || !wrapWeightGrams || !volume || !properties.length) {
      return NextResponse.json({
        error: 'CJ product details are missing weight, packed weight, volume, or logistics properties; no values were guessed and no quote was sent',
      }, { status: 422, ...noStore })
    }

    const quotes = await cjClient.calculateFreight({
      startCountryCode: originCountryCode,
      endCountryCode: 'IE',
      ...(zip ? { zip } : {}),
      variantId,
      sku: variant.variantSku,
      quantity,
      weightGrams,
      wrapWeightGrams,
      volumeMm3: volume,
      productProperties: properties,
    })
    return NextResponse.json({
      destinationCountryCode: 'IE',
      quotes: quotes.map(normalizeFreightQuote),
      checkedAt: new Date().toISOString(),
      note: 'Live read-only estimate from CJ freightCalculateTip. CJ variant/packed weights are grams; variant volume is converted from CJ mm³ to the freight endpoint’s cm³ units. Multi-unit quotes scale the CJ per-unit specifications. This does not reserve stock or create an order.',
    }, noStore)
  } catch (error) {
    logCjError('[admin/cj-catalogue/freight]', error)
    return NextResponse.json({ error: 'CJ Ireland shipping quote failed' }, { status: 502, ...noStore })
  }
}
