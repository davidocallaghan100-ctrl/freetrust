export const FREETRUST_PRODUCT_FEE_RATE = 0.05
export const FREETRUST_PRODUCT_FEE_LABEL = '5% FreeTrust fee'

export function centsFromEur(amount: number | null | undefined): number {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return 0
  return Math.round(amount * 100)
}

export function eurFromCents(cents: number): number {
  return Math.round((cents / 100) * 100) / 100
}

export function calculateProductBasketTotals(subtotalCents: number) {
  const safeSubtotal = Math.max(0, Math.round(subtotalCents))
  const platformFeeCents = Math.round(safeSubtotal * FREETRUST_PRODUCT_FEE_RATE)
  return {
    subtotalCents: safeSubtotal,
    platformFeeCents,
    totalCents: safeSubtotal + platformFeeCents,
  }
}

export function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
