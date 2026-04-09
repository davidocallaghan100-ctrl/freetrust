'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export type CurrencyCode = 'EUR' | 'GBP' | 'USD'

interface CurrencyInfo {
  code: CurrencyCode
  symbol: string
  label: string
  flag: string
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'EUR', symbol: '€', label: 'Euro',           flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', label: 'British Pound',  flag: '🇬🇧' },
  { code: 'USD', symbol: '$', label: 'US Dollar',       flag: '🇺🇸' },
]

// Approximate exchange rates relative to EUR (base)
const RATES: Record<CurrencyCode, number> = {
  EUR: 1.0,
  GBP: 0.86,
  USD: 1.08,
}

interface CurrencyContextValue {
  currency: CurrencyInfo
  setCurrency: (code: CurrencyCode) => void
  format: (amount: number, fromCurrency?: CurrencyCode) => string
  convert: (amount: number, fromCurrency?: CurrencyCode) => number
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

const STORAGE_KEY = 'freetrust_currency'
const DEFAULT: CurrencyCode = 'EUR'

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState<CurrencyCode>(DEFAULT)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as CurrencyCode | null
      if (saved && CURRENCIES.find(c => c.code === saved)) setCode(saved)
    } catch {}
  }, [])

  const setCurrency = useCallback((c: CurrencyCode) => {
    setCode(c)
    try { localStorage.setItem(STORAGE_KEY, c) } catch {}
  }, [])

  const convert = useCallback((amount: number, fromCurrency: CurrencyCode = 'EUR'): number => {
    // Convert from source currency → EUR → target currency
    const inEur = amount / RATES[fromCurrency]
    return inEur * RATES[code]
  }, [code])

  const format = useCallback((amount: number, fromCurrency: CurrencyCode = 'EUR'): string => {
    const converted = convert(amount, fromCurrency)
    const info = CURRENCIES.find(c => c.code === code)!
    return `${info.symbol}${converted.toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }, [convert, code])

  const currency = CURRENCIES.find(c => c.code === code)!

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, format, convert }}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within CurrencyProvider')
  return ctx
}
