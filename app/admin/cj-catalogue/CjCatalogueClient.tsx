'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import styles from './CjCatalogueClient.module.css'

type ProductSummary = {
  id: string | null
  title: string | null
  sku: string | null
  imageUrl: string | null
  category: string | null
  supplierPriceUsd: string | number | null
  verifiedInventoryReported: number
}

type WarehouseStock = { countryCode: string | null; quantity: number }
type ProductVariant = {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  priceUsd: number | null
  weightGrams: number | null
  volumeMm3: number | null
  lengthMm: number | null
  widthMm: number | null
  heightMm: number | null
  warehouses: WarehouseStock[]
  totalVerifiedQuantity: number
}
type ProductDetails = {
  id: string | null
  title: string | null
  sku: string | null
  imageUrl: string | null
  images: string[]
  supplierPriceUsd: number | null
  packedWeightGrams: number | null
  productProperties: string[]
  variants: ProductVariant[]
}
type FreightQuote = {
  logisticsName: string | null
  arrivalTime: string | null
  postageUsdCents: number | null
  taxesUsdCents: number | null
  clearanceOperationUsdCents: number | null
  tariffUsdCents: number | null
  totalPostageUsdCents: number | null
  error: string | null
}
type QuoteResponse = { quotes: FreightQuote[]; checkedAt: string; note: string }

function payloadError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: unknown }).error
    if (typeof error === 'string' && error.trim()) return error
  }
  return fallback
}

function usd(value: number | string | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—'
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'USD' }).format(Number(value))
}

function usdCents(value: number | null) {
  return value === null ? '—' : usd(value / 100)
}

function count(value: number) {
  return value.toLocaleString('en-IE')
}

export default function CjCatalogueClient() {
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [product, setProduct] = useState<ProductDetails | null>(null)
  const [loadingProduct, setLoadingProduct] = useState(false)
  const [productError, setProductError] = useState('')
  const [variantId, setVariantId] = useState('')
  const [origin, setOrigin] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [eircode, setEircode] = useState('')
  const [quoting, setQuoting] = useState(false)
  const [quoteError, setQuoteError] = useState('')
  const [quote, setQuote] = useState<QuoteResponse | null>(null)

  const selectedVariant = product?.variants.find((variant) => variant.id === variantId) ?? null
  const selectedWarehouse = selectedVariant?.warehouses.find((warehouse) => warehouse.countryCode === origin) ?? null
  const quantityValue = Number(quantity)
  const canQuote = Boolean(selectedVariant?.sku && selectedVariant.weightGrams && selectedVariant.volumeMm3
    && product?.packedWeightGrams && product.productProperties.length > 0 && selectedWarehouse && Number.isInteger(quantityValue)
    && quantityValue > 0 && quantityValue <= selectedWarehouse.quantity && quantityValue <= 50)

  async function search(event?: FormEvent<HTMLFormElement>, requestedPage = 1) {
    event?.preventDefault()
    const term = query.trim()
    if (term.length < 2 || term.length > 100) {
      setSearchError('Search terms must contain 2–100 characters.')
      return
    }
    setSearching(true)
    setSearchError('')
    setProducts([])
    setProduct(null)
    setVariantId('')
    setOrigin('')
    setQuote(null)
    setPage(requestedPage)
    try {
      const response = await fetch(`/api/admin/cj-catalogue?q=${encodeURIComponent(term)}&page=${requestedPage}`, { cache: 'no-store' })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payloadError(data, `Supplier search failed (${response.status}).`))
      const result = data as { products?: ProductSummary[]; page?: number; totalPages?: number }
      setProducts(Array.isArray(result.products) ? result.products : [])
      setPage(typeof result.page === 'number' ? result.page : requestedPage)
      setTotalPages(typeof result.totalPages === 'number' ? result.totalPages : 0)
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Supplier search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function inspect(item: ProductSummary) {
    if (!item.id) return
    setProduct(null)
    setProductError('')
    setLoadingProduct(true)
    setVariantId('')
    setOrigin('')
    setQuote(null)
    try {
      const response = await fetch(`/api/admin/cj-catalogue?productId=${encodeURIComponent(item.id)}`, { cache: 'no-store' })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payloadError(data, `Product lookup failed (${response.status}).`))
      const result = data as { product?: ProductDetails }
      if (!result.product) throw new Error('CJ returned no product details.')
      setProduct(result.product)
    } catch (error) {
      setProductError(error instanceof Error ? error.message : 'Product lookup failed.')
    } finally {
      setLoadingProduct(false)
    }
  }

  function chooseVariant(variant: ProductVariant) {
    if (!variant.warehouses.length) return
    setVariantId(variant.id)
    setOrigin(variant.warehouses.find((warehouse) => warehouse.countryCode)?.countryCode ?? '')
    setQuote(null)
    setQuoteError('')
  }

  async function getFreight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!product?.id || !selectedVariant || !selectedWarehouse || !canQuote) return
    setQuoting(true)
    setQuoteError('')
    setQuote(null)
    try {
      const response = await fetch('/api/admin/cj-catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          productId: product.id,
          variantId: selectedVariant.id,
          originCountryCode: selectedWarehouse.countryCode,
          quantity: quantityValue,
          ...(eircode.trim() ? { zip: eircode.trim() } : {}),
        }),
      })
      const data: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payloadError(data, `Ireland freight lookup failed (${response.status}).`))
      setQuote(data as QuoteResponse)
    } catch (error) {
      setQuoteError(error instanceof Error ? error.message : 'Ireland freight lookup failed.')
    } finally {
      setQuoting(false)
    }
  }

  return (
    <main className={styles.shell}>
      <aside className={styles.sidebar} aria-label="FreeTrust admin navigation">
        <Link href="/admin" className={styles.brand}><span className={styles.mark}>FT</span><span>FreeTrust</span><small>ADMIN</small></Link>
        <div className={styles.navLabel}>Commerce</div>
        <nav className={styles.nav}>
          <Link href="/admin">⌂ &nbsp; Admin dashboard</Link>
          <Link href="/admin/cj-catalogue" aria-current="page">▱ &nbsp; CJ supplier catalogue</Link>
          <Link href="/products">↗ &nbsp; Retailer products</Link>
        </nav>
        <div className={styles.sidebarFoot}>Private admin workspace<br />Supplier actions are read-only.</div>
      </aside>

      <section className={styles.content}>
        <header className={styles.topbar}><div><Link href="/admin">Admin</Link><span> / </span><span>Supplier catalogue</span></div><span className={styles.privateTag}>David-only</span></header>
        <div className={styles.headingRow}>
          <div><p className={styles.eyebrow}>CJ DROPSHIPPING · IRELAND</p><h1>Supplier catalogue</h1><p className={styles.subtitle}>Inspect live supplier data without publishing or ordering.</p></div>
          <span className={styles.readOnly}>READ-ONLY · NOTHING PUBLISHED</span>
        </div>

        <div className={styles.columns}>
          <div className={styles.mainColumn}>
            <form className={styles.search} onSubmit={(event) => void search(event, 1)}>
              <label className={styles.srOnly} htmlFor="cj-search">Search CJ products</label>
              <input id="cj-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" minLength={2} maxLength={100} autoComplete="off" spellCheck={false} placeholder="Search the live CJ catalogue" />
              <button type="submit" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
            </form>
            {searchError ? <p className={styles.error} role="alert">{searchError}</p> : null}
            {searching ? <p className={styles.status} role="status">Searching live supplier data…</p> : null}
            {!searching && !searchError && products.length === 0 ? (
              <div className={styles.empty}><span aria-hidden="true">▱</span><h2>Search real CJ products</h2><p>Only currently on-sale supplier products with verified inventory are shown. No sample catalogue data is used.</p></div>
            ) : null}
            {products.length > 0 ? (
              <div className={styles.results}>
                <p className={styles.status}>{products.length} candidate products · page {page}</p>
                {products.map((item, index) => (
                  <button type="button" key={item.id ?? `${item.title}-${index}`} className={styles.productRow} onClick={() => void inspect(item)} aria-pressed={product?.id === item.id}>
                    <span className={styles.thumb}>{item.imageUrl?.startsWith('https://') ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span aria-hidden="true">▱</span>}</span>
                    <span className={styles.productText}><strong>{item.title ?? 'Unnamed CJ product'}</strong><small>{item.category ?? 'Supplier product'}{item.sku ? ` · SKU ${item.sku}` : ''}</small><small>Supplier {usd(item.supplierPriceUsd)} · {count(item.verifiedInventoryReported)} screened units</small></span>
                    <span className={styles.inspect}>Inspect</span>
                  </button>
                ))}
                {totalPages > 1 ? <div className={styles.pagination}><button type="button" disabled={searching || page <= 1} onClick={() => void search(undefined, page - 1)}>Previous</button><span>Page {page} of {totalPages}</span><button type="button" disabled={searching || page >= totalPages} onClick={() => void search(undefined, page + 1)}>Next</button></div> : null}
              </div>
            ) : null}
            {loadingProduct ? <p className={styles.status} role="status">Checking real variant details and verified stock…</p> : null}
            {productError ? <p className={styles.error} role="alert">{productError}</p> : null}

            {product ? (
              <section className={styles.detailCard} aria-live="polite">
                <div className={styles.detailHeading}>
                  <div><p className={styles.eyebrow}>SELECTED CJ PRODUCT</p><h2>{product.title ?? 'Supplier product'}</h2><p className={styles.subtitle}>Product ID {product.id} · SKU {product.sku ?? 'not supplied'}</p></div>
                  <span className={styles.liveTag}>Live lookup</span>
                </div>
                <div className={styles.gallery}>
                  {(product.images.length ? product.images : product.imageUrl ? [product.imageUrl] : []).filter((image) => image.startsWith('https://')).slice(0, 6).map((image, index) => <img key={`${image}-${index}`} src={image} alt={`${product.title ?? 'CJ product'} image ${index + 1}`} loading="lazy" />)}
                </div>
                <div className={styles.productFacts}><span>Supplier price <strong>{usd(product.supplierPriceUsd)}</strong></span><span>Pack weight <strong>{product.packedWeightGrams ? `${product.packedWeightGrams} g` : 'Not provided'}</strong></span><span>Logistics properties <strong>{product.productProperties.join(', ') || 'Not provided'}</strong></span></div>
                <h3 className={styles.sectionTitle}>Variants &amp; verified stock</h3>
                {!product.variants.length ? <p className={styles.emptyInline}>CJ returned no product variants.</p> : null}
                <div className={styles.variantList}>
                  {product.variants.map((variant) => (
                    <button type="button" key={variant.id} className={styles.variant} aria-pressed={variantId === variant.id} disabled={variant.warehouses.length === 0} onClick={() => chooseVariant(variant)}>
                      {variant.imageUrl?.startsWith('https://') ? <img className={styles.variantImage} src={variant.imageUrl} alt="" loading="lazy" /> : null}
                      <span className={styles.variantBody}><strong>{variant.name}</strong><small>{variant.sku ? `SKU ${variant.sku} · ` : ''}{variant.priceUsd === null ? 'Price not provided' : `${usd(variant.priceUsd)} USD`}</small><small>{variant.weightGrams ? `${variant.weightGrams} g · ` : ''}{variant.volumeMm3 ? `${count(variant.volumeMm3)} mm³ · ` : ''}{variant.lengthMm && variant.widthMm && variant.heightMm ? `${variant.lengthMm} × ${variant.widthMm} × ${variant.heightMm} mm` : 'dimensions not supplied'}</small><small>{variant.warehouses.length ? variant.warehouses.map((warehouse) => `${warehouse.countryCode ?? 'Origin unavailable'}: ${count(warehouse.quantity)}`).join(' · ') : 'No positive verified CJ-managed stock'}</small></span>
                      <span className={styles.stockTag}>{variant.totalVerifiedQuantity > 0 ? `${count(variant.totalVerifiedQuantity)} verified` : 'Out of stock'}</span>
                    </button>
                  ))}
                </div>

                {selectedVariant ? (
                  <form className={styles.freightForm} onSubmit={(event) => void getFreight(event)}>
                    <div><h3>Live shipping estimate to Ireland</h3><p className={styles.subtitle}>Uses CJ-reported variant weight, packed weight, volume and logistics properties; no shipping specifications are guessed.</p></div>
                    {quoteError ? <p className={styles.error} role="alert">{quoteError}</p> : null}
                    <div className={styles.quoteInputs}>
                      <label>Verified stock origin<select value={origin} onChange={(event) => { setOrigin(event.target.value); setQuote(null) }}>{selectedVariant.warehouses.filter((warehouse) => warehouse.countryCode).map((warehouse) => <option key={warehouse.countryCode} value={warehouse.countryCode!}>{warehouse.countryCode} · {count(warehouse.quantity)} units</option>)}</select></label>
                      <label>Quantity<input type="number" inputMode="numeric" min="1" max={Math.min(50, selectedWarehouse?.quantity ?? 1)} step="1" value={quantity} onChange={(event) => { setQuantity(event.target.value); setQuote(null) }} /></label>
                      <label className={styles.wide}>Irish Eircode (optional)<input type="text" autoComplete="postal-code" maxLength={20} value={eircode} onChange={(event) => { setEircode(event.target.value); setQuote(null) }} placeholder="Leave blank for Ireland country-level estimate" /></label>
                    </div>
                    <button className={styles.quoteButton} type="submit" disabled={!canQuote || quoting}>{quoting ? 'Getting CJ estimate…' : 'Get Ireland shipping estimate'}</button>
                    {quote ? <div className={styles.quotes} aria-live="polite">
                      <p className={styles.status}>Checked {new Date(quote.checkedAt).toLocaleString('en-IE')} · values in USD</p>
                      {quote.quotes.length ? quote.quotes.map((option, index) => <article className={styles.quoteCard} key={`${option.logisticsName ?? 'option'}-${index}`}><div className={styles.quoteHeader}><strong>{option.logisticsName ?? `Shipping option ${index + 1}`}</strong><strong>{usdCents(option.totalPostageUsdCents)}</strong></div>{option.arrivalTime ? <p className={styles.subtitle}>Estimated arrival: {option.arrivalTime}</p> : null}{option.error ? <p className={styles.error}>{option.error}</p> : null}<div className={styles.fees}><span>Postage</span><strong>{usdCents(option.postageUsdCents)}</strong><span>Taxes</span><strong>{usdCents(option.taxesUsdCents)}</strong><span>Customs clearance</span><strong>{usdCents(option.clearanceOperationUsdCents)}</strong><span>Tariff</span><strong>{usdCents(option.tariffUsdCents)}</strong></div></article>) : <p className={styles.emptyInline}>CJ returned no shipping options for these exact inputs.</p>}
                      <p className={styles.status}>{quote.note}</p>
                    </div> : null}
                  </form>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className={styles.checks}>
            <h2>Review status</h2>
            <div className={styles.fact}><span>Target gross margin</span><strong>20% of verified landed cost</strong></div>
            <div className={styles.fact}><span>Supplier price</span><strong>{selectedVariant?.priceUsd ? usd(selectedVariant.priceUsd) : '—'}</strong></div>
            <div className={styles.fact}><span>Landed EUR cost</span><strong>Not calculated</strong></div>
            <div className={styles.fact}><span>Public catalogue</span><strong>Disabled</strong></div>
            <div className={styles.fact}><span>Checkout &amp; orders</span><strong>Disabled</strong></div>
            <button type="button" disabled className={styles.publish}>Publish product</button>
            <p className={styles.finePrint}>No product is saved, published, sold, or ordered. Landed EUR cost and retail pricing stay blank pending FX, VAT/IOSS, and fee approval.</p>
          </aside>
        </div>
        <p className={styles.notice}>CJ catalogue, stock and freight are live snapshots. A freight estimate is not a stock reservation or a delivery guarantee.</p>
      </section>
    </main>
  )
}
