// Rent & Share booking pricing helper.
// Given a listing's pricing fields and a date range, compute the total amount
// owed for a rental request. Prefers price_per_month for long stays when set,
// otherwise falls back to price_per_week, then price_per_day.
//
// This intentionally mirrors "nights" semantics used across the rest of the
// app (from_date inclusive, to_date exclusive checkout — i.e. a booking from
// 2026-09-01 to 2026-09-03 is 2 nights).

export interface RentShareListingPricing {
  price_per_day?: number | null
  price_per_week?: number | null
  price_per_month?: number | null
}

export interface RentAmountBreakdown {
  nights: number
  rateUsed: 'day' | 'week' | 'month' | 'none'
  rateValue: number
  amount: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function computeRentalAmount(
  listing: RentShareListingPricing,
  fromDate: string | Date,
  toDate: string | Date,
): RentAmountBreakdown {
  const from = new Date(fromDate)
  const to = new Date(toDate)
  const nights = Math.max(1, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY))

  // Prefer monthly rate for stays of 28+ nights when set, else weekly for 7+
  // nights when set, else fall back to the daily rate (or 0 if none is set —
  // callers should treat rateUsed === 'none' as "cannot price this booking").
  if (nights >= 28 && listing.price_per_month != null) {
    const months = nights / 30
    const amount = round2(Number(listing.price_per_month) * months)
    return { nights, rateUsed: 'month', rateValue: Number(listing.price_per_month), amount }
  }

  if (nights >= 7 && listing.price_per_week != null) {
    const weeks = nights / 7
    const amount = round2(Number(listing.price_per_week) * weeks)
    return { nights, rateUsed: 'week', rateValue: Number(listing.price_per_week), amount }
  }

  if (listing.price_per_day != null) {
    const amount = round2(Number(listing.price_per_day) * nights)
    return { nights, rateUsed: 'day', rateValue: Number(listing.price_per_day), amount }
  }

  return { nights, rateUsed: 'none', rateValue: 0, amount: 0 }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
