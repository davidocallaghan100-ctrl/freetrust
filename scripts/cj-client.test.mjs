import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }
    return nextResolve(specifier, context)
  },
})

const { CjDropshippingClient, verifiedStockByVariant } = await import('../lib/fulfillment/cj-client.ts')

function cjResponse(data) {
  return new Response(JSON.stringify({ code: 200, result: true, success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function tokenResponse() {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  return cjResponse({ accessToken: `access-${Math.random()}`, accessTokenExpiryDate: future, refreshToken: 'refresh', refreshTokenExpiryDate: future })
}

function clientOptions(apiKey, fetchImpl) {
  return { apiKey, fetchImpl, sleep: async () => undefined }
}

test('stock summary includes only positive CJ-managed verified warehouse units', () => {
  const result = verifiedStockByVariant({ variantInventories: [
    { vid: 'variant-1', inventory: [
      { countryCode: 'DE', verifiedWarehouse: 1, cjInventory: '5', factoryInventory: '900' },
      { countryCode: 'CN', verifiedWarehouse: 0, cjInventory: '70' },
      { countryCode: 'US', verifiedWarehouse: 1, cjInventory: '0', factoryInventory: '12' },
    ] },
    { vid: 'variant-2', inventory: [{ countryCode: 'IE', verifiedWarehouse: 1, cjInventory: 0 }] },
  ] })
  assert.deepEqual(result, [{ variantId: 'variant-1', warehouses: [{ countryCode: 'DE', quantity: 5 }], totalVerifiedQuantity: 5 }])
})

test('search is restricted to active CJ supplier products with verified inventory filters', async () => {
  let searchUrl = ''
  const client = new CjDropshippingClient(clientOptions('test-search-contract', async (input) => {
    const url = String(input)
    if (url.endsWith('/authentication/getAccessToken')) return tokenResponse()
    searchUrl = url
    return cjResponse({ pageNumber: 1, totalPages: 1, content: [{ productList: [{ id: 'product-1', nameEn: 'Real product' }] }] })
  }))
  const result = await client.searchProducts('storage', 1, 10)
  const params = new URL(searchUrl).searchParams
  assert.equal(params.get('productType'), '4')
  assert.equal(params.get('verifiedWarehouse'), '1')
  assert.equal(params.get('startWarehouseInventory'), '1')
  assert.equal(params.get('keyWord'), 'storage')
  assert.equal(params.get('countryCode'), null)
  assert.equal(result.products[0].id, 'product-1')
})

test('details lookup uses product/query and returns variant names, SKU, price and logistics fields', async () => {
  let detailsUrl = ''
  const client = new CjDropshippingClient(clientOptions('test-product-details', async (input) => {
    const url = String(input)
    if (url.endsWith('/authentication/getAccessToken')) return tokenResponse()
    detailsUrl = url
    return cjResponse({ pid: 'product-1', variants: [{ vid: 'variant-1', variantNameEn: 'Blue', variantSku: 'SKU-BLUE', variantSellPrice: 5.5, variantWeight: 100, variantVolume: 60000 }] })
  }))
  const details = await client.getProductDetails('product-1')
  assert.ok(detailsUrl.endsWith('/product/query?pid=product-1'))
  assert.equal(details.variants?.[0].variantNameEn, 'Blue')
  assert.equal(details.variants?.[0].variantSku, 'SKU-BLUE')
  assert.equal(details.variants?.[0].variantSellPrice, 5.5)
  assert.equal(details.variants?.[0].variantVolume, 60000)
})

test('access token is cached and refreshed before expiration', async () => {
  let now = Date.now()
  let accessCalls = 0
  let refreshCalls = 0
  const client = new CjDropshippingClient({
    ...clientOptions('test-token-refresh', async (input, init = {}) => {
      const url = String(input)
      if (url.endsWith('/authentication/getAccessToken')) {
        accessCalls += 1
        return cjResponse({ accessToken: 'initial-token', accessTokenExpiryDate: new Date(now + 120_000).toISOString(), refreshToken: 'refresh-token', refreshTokenExpiryDate: new Date(now + 600_000).toISOString() })
      }
      if (url.endsWith('/authentication/refreshAccessToken')) {
        refreshCalls += 1
        assert.equal(JSON.parse(String(init.body)).refreshToken, 'refresh-token')
        return cjResponse({ accessToken: 'refreshed-token', accessTokenExpiryDate: new Date(now + 120_000).toISOString(), refreshToken: 'rotated-token', refreshTokenExpiryDate: new Date(now + 600_000).toISOString() })
      }
      return cjResponse({ variantInventories: [] })
    }),
    now: () => now,
  })
  await client.getProductInventory('product-1')
  await client.getProductInventory('product-2')
  assert.equal(accessCalls, 1)
  now += 70_000
  await client.getProductInventory('product-3')
  assert.equal(accessCalls, 1)
  assert.equal(refreshCalls, 1)
})

test('Ireland freight uses exact CJ specs and supplier product type in the detailed quote contract', async () => {
  let freightUrl = ''
  let freightBody
  const client = new CjDropshippingClient(clientOptions('test-freight-contract', async (input, init = {}) => {
    const url = String(input)
    if (url.endsWith('/authentication/getAccessToken')) return tokenResponse()
    freightUrl = url
    freightBody = JSON.parse(String(init.body))
    return cjResponse([{ option: { enName: 'CJ Ireland service' }, wrapPostage: 4.25, arrivalTime: '8-15 days' }])
  }))
  const quotes = await client.calculateFreight({
    startCountryCode: 'DE', endCountryCode: 'IE', zip: 'D02 X285', variantId: 'variant-1', sku: 'SKU-BLUE',
    quantity: 2, weightGrams: 100, wrapWeightGrams: 120, volumeMm3: 60000, productProperties: ['COMMON'],
  })
  assert.ok(freightUrl.endsWith('/logistic/freightCalculateTip'))
  const [row] = freightBody.reqDTOS
  assert.equal(row.srcAreaCode, 'DE')
  assert.equal(row.destAreaCode, 'IE')
  assert.equal(row.zip, 'D02 X285')
  assert.equal(row.weight, 200)
  assert.equal(row.wrapWeight, 240)
  assert.equal(row.volume, 120)
  assert.deepEqual(row.productProp, ['COMMON'])
  assert.deepEqual(row.productTypes, ['4'])
  assert.deepEqual(row.skuList, ['SKU-BLUE'])
  assert.equal(row.freightTrialSkuList[0].vid, 'variant-1')
  assert.equal(row.freightTrialSkuList[0].skuQuantity, 2)
  assert.equal(row.freightTrialSkuList[0].skuWeight, 100)
  assert.equal(row.freightTrialSkuList[0].skuVolume, 60)
  assert.equal(quotes[0].wrapPostage, 4.25)
})

test('freight rejects missing CJ logistics properties before any API request', async () => {
  let calls = 0
  const client = new CjDropshippingClient(clientOptions('test-invalid-freight', async () => {
    calls += 1
    return tokenResponse()
  }))
  await assert.rejects(client.calculateFreight({
    startCountryCode: 'DE', endCountryCode: 'IE', variantId: 'variant-1', sku: 'SKU-1', quantity: 1,
    weightGrams: 100, wrapWeightGrams: 120, volumeMm3: 60000, productProperties: [],
  }), /logistics properties are required/i)
  assert.equal(calls, 0)
})
