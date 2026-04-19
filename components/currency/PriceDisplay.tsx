'use client'
import React from 'react'
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext'

// Dual-currency price display: large primary in the user's selected
// currency, smaller secondary in EUR underneath. Used on every listing
// card so global users see a familiar price alongside the FreeTrust
// platform base currency.
//
// Props:
//   amountEur  — price in EUR (the canonical DB value stored in price_eur)
//   sourceCode — the currency the listing was created in (for the second line)
//   sourceAmount — optional original amount in sourceCode (e.g. the raw `price` column)
//   size       — "sm" | "md" | "lg" (default md)
//   layout     — "stacked" (default) or "inline"
//
// If the user's selected currency IS EUR, we skip the second line to
// avoid redundant "€30 / €30".

export type PriceDisplaySize = 'sm' | 'md' | 'lg'

export interface PriceDisplayProps {
  amountEur: number | null | undefined
  sourceCode?: CurrencyCode | null
  sourceAmount?: number | null
  size?: PriceDisplaySize
  layout?: 'stacked' | 'inline'
  freeLabel?: string
}

const SIZE_MAP: Record<PriceDisplaySize, { primary: number; secondary: number }> = {
  sm: { primary: 13, secondary: 11 },
  md: { primary: 15, secondary: 11 },
  lg: { primary: 22, secondary: 13 },
}

export default function PriceDisplay({
  amountEur,
  sourceCode,
  sourceAmount,
  size = 'md',
  layout = 'stacked',
  freeLabel = 'Free',
}: PriceDisplayProps) {
  const { currency, format, formatIn } = useCurrency()

  // Treat amountEur=0 as "free" only when sourceAmount is also 0 or absent.
  // If sourceAmount has a real value, fall through to display it.
  const effectiveAmount = (amountEur == null || amountEur === 0)
    ? (sourceAmount && sourceAmount > 0 ? sourceAmount : 0)
    : amountEur

  if (effectiveAmount === 0) {
    return (
      <span style={{
        fontSize: SIZE_MAP[size].primary,
        fontWeight: 700,
        color: '#34d399',
      }}>
        {freeLabel}
      </span>
    )
  }

  const primary = format(effectiveAmount, 'EUR')

  // Only show the EUR secondary line if the user is viewing a non-EUR
  // currency. If the source currency exists and isn't EUR, prefer
  // showing the original amount (e.g. "₹2,499") on the second line.
  const showSecondary = currency.code !== 'EUR'
  const secondaryText =
    sourceCode && sourceCode !== 'EUR' && typeof sourceAmount === 'number'
      ? formatIn(sourceAmount, sourceCode)
      : formatIn(effectiveAmount, 'EUR')

  if (layout === 'inline') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: SIZE_MAP[size].primary, fontWeight: 700, color: '#f1f5f9' }}>
          {primary}
        </span>
        {showSecondary && (
          <span style={{ fontSize: SIZE_MAP[size].secondary, color: '#64748b' }}>
            ≈ {secondaryText}
          </span>
        )}
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <span style={{
        fontSize: SIZE_MAP[size].primary, fontWeight: 700, color: '#f1f5f9',
        lineHeight: 1.15,
      }}>
        {primary}
      </span>
      {showSecondary && (
        <span style={{ fontSize: SIZE_MAP[size].secondary, color: '#64748b', marginTop: 2 }}>
          ≈ {secondaryText}
        </span>
      )}
    </div>
  )
}
