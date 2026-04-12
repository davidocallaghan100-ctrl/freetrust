'use client'
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

// ────────────────────────────────────────────────────────────────────────────
// Globalised currency context
// ────────────────────────────────────────────────────────────────────────────
// Previously hardcoded EUR / GBP / USD with static rates. Now supports 20+
// currencies covering every major market, and fetches live exchange rates
// from Frankfurter (https://www.frankfurter.app — free, no API key, based
// on the European Central Bank reference rates).
//
// Design notes:
//   * Base currency stored in the DB is always EUR — every listing table
//     has a `price_eur` column the server populates at write time, and the
//     client only needs base→target conversion for display.
//   * Fetched rates are cached in localStorage for 6 hours to avoid
//     hammering Frankfurter and to keep the UI snappy on cold loads.
//   * The hardcoded fallback rates ship with the module so the UI still
//     renders reasonable conversions if the network is unavailable at
//     first mount. They're overwritten as soon as live rates arrive.
//   * Changing currencies is idempotent and persisted to localStorage.
//
// Consumers (unchanged API):
//   const { currency, setCurrency, format, convert } = useCurrency()

export type CurrencyCode =
  | 'EUR' | 'GBP' | 'USD' | 'CAD' | 'AUD' | 'NZD'
  | 'CHF' | 'SEK' | 'NOK' | 'DKK' | 'PLN' | 'CZK'
  | 'JPY' | 'CNY' | 'HKD' | 'SGD' | 'INR'
  | 'BRL' | 'MXN' | 'ZAR'

interface CurrencyInfo {
  code: CurrencyCode
  symbol: string
  label: string
  flag: string
  decimals: number          // number of fraction digits for display
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', symbol: '€',  label: 'Euro',           flag: '🇪🇺', decimals: 2 },
  { code: 'GBP', symbol: '£',  label: 'British Pound',  flag: '🇬🇧', decimals: 2 },
  { code: 'USD', symbol: '$',  label: 'US Dollar',      flag: '🇺🇸', decimals: 2 },
  { code: 'CAD', symbol: 'C$', label: 'Canadian Dollar',flag: '🇨🇦', decimals: 2 },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar', flag: '🇦🇺', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$',label: 'NZ Dollar',      flag: '🇳🇿', decimals: 2 },
  { code: 'CHF', symbol: 'CHF',label: 'Swiss Franc',    flag: '🇨🇭', decimals: 2 },
  { code: 'SEK', symbol: 'kr', label: 'Swedish Krona',  flag: '🇸🇪', decimals: 2 },
  { code: 'NOK', symbol: 'kr', label: 'Norwegian Krone',flag: '🇳🇴', decimals: 2 },
  { code: 'DKK', symbol: 'kr', label: 'Danish Krone',   flag: '🇩🇰', decimals: 2 },
  { code: 'PLN', symbol: 'zł', label: 'Polish Zloty',   flag: '🇵🇱', decimals: 2 },
  { code: 'CZK', symbol: 'Kč', label: 'Czech Koruna',   flag: '🇨🇿', decimals: 2 },
  { code: 'JPY', symbol: '¥',  label: 'Japanese Yen',   flag: '🇯🇵', decimals: 0 },
  { code: 'CNY', symbol: '¥',  label: 'Chinese Yuan',   flag: '🇨🇳', decimals: 2 },
  { code: 'HKD', symbol: 'HK$',label: 'Hong Kong Dollar',flag: '🇭🇰', decimals: 2 },
  { code: 'SGD', symbol: 'S$', label: 'Singapore Dollar',flag: '🇸🇬', decimals: 2 },
  { code: 'INR', symbol: '₹',  label: 'Indian Rupee',   flag: '🇮🇳', decimals: 0 },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real', flag: '🇧🇷', decimals: 2 },
  { code: 'MXN', symbol: 'Mex$',label:'Mexican Peso',   flag: '🇲🇽', decimals: 2 },
  { code: 'ZAR', symbol: 'R',  label: 'South African Rand', flag: '🇿🇦', decimals: 2 },
]

// Fallback rates relative to EUR=1. Overwritten by the live fetch.
// Rough April 2026 values — good enough to render something useful
// before the first Frankfurter response lands.
const FALLBACK_RATES: Record<CurrencyCode, number> = {
  EUR: 1.00, GBP: 0.86, USD: 1.08, CAD: 1.48, AUD: 1.65, NZD: 1.80,
  CHF: 0.97, SEK: 11.5, NOK: 11.8, DKK: 7.46, PLN: 4.30, CZK: 25.0,
  JPY: 162,  CNY: 7.80, HKD: 8.45, SGD: 1.45, INR: 91.0,
  BRL: 5.50, MXN: 19.5, ZAR: 20.0,
}

const STORAGE_KEY        = 'freetrust_currency'
const RATES_STORAGE_KEY  = 'freetrust_currency_rates'
const RATES_MAX_AGE_MS   = 6 * 60 * 60 * 1000 // 6 hours
const DEFAULT: CurrencyCode = 'EUR'

interface CachedRates {
  base: 'EUR'
  rates: Record<CurrencyCode, number>
  fetched_at: number
}

interface CurrencyContextValue {
  currency: CurrencyInfo
  setCurrency: (code: CurrencyCode) => void
  /** Format `amount` (assumed to be in `fromCurrency`, defaulting to EUR) into the user's selected display currency */
  format: (amount: number, fromCurrency?: CurrencyCode) => string
  /** Convert `amount` from `fromCurrency` → user's selected display currency */
  convert: (amount: number, fromCurrency?: CurrencyCode) => number
  /** Format a raw amount in a given currency without converting — used when you want "€30 (= $32)" side-by-side */
  formatIn: (amount: number, code: CurrencyCode) => string
  /** True once the live rates have arrived */
  ratesLoaded: boolean
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>(DEFAULT)
  const [rates, setRates] = useState<Record<CurrencyCode, number>>(FALLBACK_RATES)
  const [ratesLoaded, setRatesLoaded] = useState(false)
  const fetchedRef = useRef(false)

  // 1. Read saved currency preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null
      if (saved && CURRENCIES.find(c => c.code === saved)) setCode(saved)
    } catch {}
  }, [])

  // 2. Read cached rates and — if stale — refetch from Frankfurter
  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true

    // Try cached rates first
    try {
      const raw = localStorage.getItem(RATES_STORAGE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as CachedRates
        if (
          cached &&
          cached.fetched_at &&
          Date.now() - cached.fetched_at < RATES_MAX_AGE_MS &&
          cached.rates
        ) {
          setRates({ ...FALLBACK_RATES, ...cached.rates })
          setRatesLoaded(true)
        }
      }
    } catch {}

    // Then refresh in the background — we don't block the UI on this
    ;(async () => {
      try {
        const codes = CURRENCIES.map(c => c.code).filter(c => c !== 'EUR').join(',')
        const res = await fetch(`https://api.frankfurter.app/latest?from=EUR&to=${codes}`, {
          cache: 'no-store',
        })
        if (!res.ok) return
        const d = await res.json() as { base: string; rates: Record<string, number> }
        if (d.base !== 'EUR' || !d.rates) return
        const merged: Record<CurrencyCode, number> = { ...FALLBACK_RATES, EUR: 1 }
        for (const c of CURRENCIES) {
          if (c.code === 'EUR') continue
          const r = d.rates[c.code]
          if (typeof r === 'number' && r > 0) merged[c.code] = r
        }
        setRates(merged)
        setRatesLoaded(true)
        try {
          localStorage.setItem(
            RATES_STORAGE_KEY,
            JSON.stringify({ base: 'EUR', rates: merged, fetched_at: Date.now() } satisfies CachedRates)
          )
        } catch {}
      } catch {
        // Swallow — we already rendered fallback rates.
      }
    })()
  }, [])

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCode(c)
    try { localStorage.setItem(STORAGE_KEY, c) } catch {}
  }, [])

  const convert = useCallback((amount: number, fromCurrency: CurrencyCode = 'EUR'): number => {
    const fromRate = rates[fromCurrency] ?? 1
    const toRate   = rates[code]          ?? 1
    // amount → EUR → target
    return (amount / fromRate) * toRate
  }, [rates, code])

  const info = CURRENCIES.find(c => c.code === code) ?? CURRENCIES[0]

  const formatAmount = useCallback((amount: number, targetCode: CurrencyCode) => {
    const target = CURRENCIES.find(c => c.code === targetCode) ?? CURRENCIES[0]
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: target.code,
        maximumFractionDigits: target.decimals,
        minimumFractionDigits: target.decimals,
      }).format(amount)
    } catch {
      // Fallback for unknown ICU locales — shouldn't happen but safe
      return `${target.symbol}${amount.toFixed(target.decimals)}`
    }
  }, [])

  const format = useCallback((amount: number, fromCurrency: CurrencyCode = 'EUR'): string => {
    return formatAmount(convert(amount, fromCurrency), code)
  }, [convert, code, formatAmount])

  const formatIn = useCallback((amount: number, currencyCode: CurrencyCode): string => {
    return formatAmount(amount, currencyCode)
  }, [formatAmount])

  return (
    <CurrencyContext.Provider value={{ currency: info, setCurrency, format, convert, formatIn, ratesLoaded }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
