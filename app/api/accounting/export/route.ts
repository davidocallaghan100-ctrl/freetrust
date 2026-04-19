export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const FEE_RATE_SERVICE = 0.08
const FEE_RATE_PRODUCT = 0.05
const VAT_RATE = 0.23

function euroFormat(cents: number): string {
  return (cents / 100).toFixed(2)
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const year  = parseInt(searchParams.get('year')  ?? String(new Date().getFullYear()), 10)
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!, 10) : null

    const admin = createAdminClient()

    let startDate: string
    let endDate: string

    if (month !== null) {
      // Specific month
      startDate = `${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`
      const nextMonth = month === 12 ? 1 : month + 1
      const nextYear  = month === 12 ? year + 1 : year
      endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00.000Z`
    } else {
      // Full year
      startDate = `${year}-01-01T00:00:00.000Z`
      endDate   = `${year + 1}-01-01T00:00:00.000Z`
    }

    const { data: orders, error } = await admin
      .from('orders')
      .select('id, item_title, item_type, amount_pence, created_at, status, buyer_id, invoice_number')
      .eq('seller_id', user.id)
      .in('status', ['completed', 'delivered'])
      .gte('created_at', startDate)
      .lt('created_at', endDate)
      .order('created_at', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Fetch buyer names
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

    // Fetch seller VAT status
    const { data: sellerProfile } = await admin
      .from('profiles')
      .select('vat_registered, vat_number')
      .eq('id', user.id)
      .maybeSingle()
    const isVat = sellerProfile?.vat_registered === true

    // Build CSV
    const headers = [
      'Invoice No',
      'Date',
      'Order Ref',
      'Buyer Name',
      'Item',
      'Type',
      'Gross (€)',
      'Platform Fee (€)',
      'Net (€)',
      ...(isVat ? ['VAT (€)', 'Total incl VAT (€)'] : []),
      'Status',
    ]

    const rows = (orders ?? []).map((o) => {
      const gross    = Number(o.amount_pence ?? 0)
      const feeRate  = String(o.item_type ?? '').toLowerCase() === 'product' ? FEE_RATE_PRODUCT : FEE_RATE_SERVICE
      const fee      = Math.round(gross * feeRate)
      const net      = gross - fee
      const vat      = isVat ? Math.round(net * VAT_RATE) : 0
      const totalVat = net + vat
      const date     = new Date(o.created_at as string).toLocaleDateString('en-IE')

      const baseRow = [
        (o.invoice_number as string) ?? '',
        date,
        (o.id as string).slice(0, 8).toUpperCase(),
        buyerMap[o.buyer_id as string] ?? 'Unknown',
        `"${String(o.item_title ?? '').replace(/"/g, '""')}"`,
        String(o.item_type ?? ''),
        euroFormat(gross),
        euroFormat(fee),
        euroFormat(net),
      ]

      if (isVat) {
        baseRow.push(euroFormat(vat), euroFormat(totalVat))
      }

      baseRow.push(String(o.status ?? ''))
      return baseRow
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ].join('\n')

    const filename = month !== null
      ? `freetrust-sales-${year}-${String(month).padStart(2, '0')}.csv`
      : `freetrust-sales-${year}.csv`

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[accounting/export]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
