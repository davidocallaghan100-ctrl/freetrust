export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface StatusHistoryEntry {
  status: string
  timestamp: string
  actor_id: string
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sellerId } = await params
    if (!sellerId) return NextResponse.json({ error: 'Missing seller id' }, { status: 400 })

    const admin = createAdminClient()

    // Get all completed/delivered orders for this seller that had an expected delivery date
    const { data: orders, error } = await admin
      .from('orders')
      .select('id, status, expected_delivery_at, status_history, created_at')
      .eq('seller_id', sellerId)
      .in('status', ['delivered', 'completed'])
      .not('expected_delivery_at', 'is', null)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!orders || orders.length === 0) {
      return NextResponse.json({ otif: null, total: 0, onTime: 0, late: 0 })
    }

    let onTime = 0
    let late = 0

    for (const order of orders) {
      const history = (order.status_history as StatusHistoryEntry[]) || []
      // Find when it was marked delivered
      const deliveredEvent = history.find((e) => e.status === 'delivered')
      const deliveredAt = deliveredEvent?.timestamp
        ? new Date(deliveredEvent.timestamp)
        : null

      const expectedAt = new Date(order.expected_delivery_at as string)

      if (deliveredAt) {
        if (deliveredAt <= expectedAt) {
          onTime++
        } else {
          late++
        }
      } else {
        // No delivery timestamp — count as on time (benefit of the doubt for completed orders)
        onTime++
      }
    }

    const total = onTime + late
    const otif = total > 0 ? Math.round((onTime / total) * 100) : null

    return NextResponse.json({ otif, total, onTime, late })
  } catch (err) {
    console.error('[OTIF GET] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
