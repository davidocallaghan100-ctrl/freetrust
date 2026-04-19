export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FEE_RATE_SERVICE = 0.08
const FEE_RATE_PRODUCT = 0.05

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()), 10)

    const admin = createAdminClient()

    // Fetch completed/delivered orders for this seller in the given year
    const startOfYear = `${year}-01-01T00:00:00.000Z`
    const endOfYear   = `${year + 1}-01-01T00:00:00.000Z`

    const { data: orders, error } = await admin
      .from('orders')
      .select('id, title, amount, created_at, status, buyer_id, invoice_number')
      .eq('seller_id', user.id)
      .in('status', ['completed', 'delivered', 'paid'])
      .gte('created_at', startOfYear)
      .lt('created_at', endOfYear)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[accounting/summary]', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Fetch buyer names for the recent invoices list
    const buyerIds = Array.from(new Set((orders ?? []).map((o) => o.buyer_id as string)))
    const buyerMap: Record<string, string> = {}
    if (buyerIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name')
        .in('id', buyerIds)
      for (const p of profiles ?? []) {
        buyerMap[p.id as string] = (p.full_name as string) || 'Unknown'
      }
    }

    // Build monthly breakdown
    const monthly: Array<{
      month: number
      monthName: string
      orders: number
      grossCents: number
      feeCents: number
      netCents: number
    }> = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      monthName: MONTH_NAMES[i],
      orders: 0,
      grossCents: 0,
      feeCents: 0,
      netCents: 0,
    }))

    for (const o of orders ?? []) {
      const month = new Date(o.created_at as string).getMonth() // 0-indexed
      // amount is stored in cents (pence) in the live DB
      const gross = Number(o.amount ?? 0)
      const feeRate = FEE_RATE_SERVICE // default; item_type column not present in live DB
      const fee  = Math.round(gross * feeRate)
      const net  = gross - fee

      monthly[month].orders    += 1
      monthly[month].grossCents += gross
      monthly[month].feeCents   += fee
      monthly[month].netCents   += net
    }

    // Yearly totals
    const totals = monthly.reduce(
      (acc, m) => ({
        orders: acc.orders + m.orders,
        grossCents: acc.grossCents + m.grossCents,
        feeCents:   acc.feeCents   + m.feeCents,
        netCents:   acc.netCents   + m.netCents,
      }),
      { orders: 0, grossCents: 0, feeCents: 0, netCents: 0 }
    )

    // Recent invoices (last 10 completed orders)
    const recentInvoices = (orders ?? [])
      .slice(-10)
      .reverse()
      .map((o) => {
        const gross = Number(o.amount ?? 0)
        const feeRate = FEE_RATE_SERVICE
        const fee  = Math.round(gross * feeRate)
        const net  = gross - fee
        return {
          id:            o.id,
          invoiceNumber: o.invoice_number ?? null,
          date:          o.created_at,
          itemTitle:     (o.title as string) ?? 'Order',
          buyerName:     buyerMap[o.buyer_id as string] ?? 'Unknown',
          grossCents:    gross,
          feeCents:      fee,
          netCents:      net,
          status:        o.status,
        }
      })

    return NextResponse.json({
      year,
      monthly,
      totals,
      recentInvoices,
    })
  } catch (err) {
    console.error('[accounting/summary]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
