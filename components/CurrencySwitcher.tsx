'use client'
import { useCurrency, CURRENCIES, CurrencyCode } from '@/context/CurrencyContext'

interface Props {
  compact?: boolean // small pill for nav, full selector for settings/pages
}

export default function CurrencySwitcher({ compact = false }: Props) {
  const { currency, setCurrency } = useCurrency()

  if (compact) {
    // Cycle through currencies on tap — used in the nav bar
    const currentIndex = CURRENCIES.findIndex(c => c.code === currency.code)
    const next = CURRENCIES[(currentIndex + 1) % CURRENCIES.length]
    return (
      <button
        onClick={() => setCurrency(next.code)}
        title={`Switch to ${next.label}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          padding: '5px 9px',
          background: 'rgba(56,189,248,0.08)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 700,
          color: '#38bdf8',
          cursor: 'pointer',
          fontFamily: 'inherit',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {currency.flag} {currency.symbol}
      </button>
    )
  }

  // Full inline switcher — 3 pill buttons
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
      {CURRENCIES.map(c => {
        const active = c.code === currency.code
        return (
          <button
            key={c.code}
            onClick={() => setCurrency(c.code as CurrencyCode)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: active ? 700 : 500,
              color: active ? '#38bdf8' : '#94a3b8',
              background: active ? 'rgba(56,189,248,0.12)' : 'transparent',
              border: active ? '1px solid rgba(56,189,248,0.35)' : '1px solid rgba(148,163,184,0.15)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {c.flag} {c.symbol} {c.code}
          </button>
        )
      })}
    </div>
  )
}
