export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface StatusHistoryEntry {
  status: string
  timestamp: string
  actor_id: string
}

type ProfileEntry = { full_name: string | null; username: string | null }

interface MemberRow {
  user_id: string
  // Supabase returns foreign-key joins as arrays
  profile: ProfileEntry[]
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

    const admin = createAdminClient()

    // Resolve slug → UUID if needed
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let orgId = id
    if (!isUUID) {
      const { data: org } = await admin.from('organisations').select('id').eq('slug', id).maybeSingle()
      if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
      orgId = org.id
    }

    // Get all member user_ids
    const { data: members, error: membersErr } = await admin
      .from('organisation_members')
      .select('user_id, profile:profiles!user_id(full_name, username)')
      .eq('organisation_id', orgId)

    if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 })
    if (!members || members.length === 0) {
      return NextResponse.json({ otif: null, total: 0, onTime: 0, late: 0, memberCount: 0, totalOrders: 0, avgRating: null, topSeller: null })
    }

    const memberIds = members.map((m: MemberRow) => m.user_id)
    const memberCount = memberIds.length

    // Get all completed orders for all members as sellers
    const { data: orders, error: ordersErr } = await admin
      .from('orders')
      .select('id, seller_id, status, expected_delivery_at, status_history')
      .in('seller_id', memberIds)
      .in('status', ['delivered', 'completed'])

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })

    const totalOrders = orders?.length ?? 0

    // Calculate OTIF across all orders
    let onTime = 0
    let late = 0
    const sellerOnTime: Record<string, number> = {}
    const sellerTotal: Record<string, number> = {}

    for (const order of orders ?? []) {
      const history = (order.status_history as StatusHistoryEntry[]) || []
      const deliveredEvent = history.find(e => e.status === 'delivered')
      const deliveredAt = deliveredEvent?.timestamp ? new Date(deliveredEvent.timestamp) : null
      const expectedAt = order.expected_delivery_at ? new Date(order.expected_delivery_at) : null

      const sid = order.seller_id
      sellerTotal[sid] = (sellerTotal[sid] || 0) + 1

      if (expectedAt) {
        const isOnTime = deliveredAt ? deliveredAt <= expectedAt : true
        if (isOnTime) {
          onTime++
          sellerOnTime[sid] = (sellerOnTime[sid] || 0) + 1
        } else {
          late++
        }
      } else {
        // No deadline — count as on time (benefit of the doubt)
        onTime++
        sellerOnTime[sid] = (sellerOnTime[sid] || 0) + 1
      }
    }

    const total = onTime + late
    const otif = total > 0 ? Math.round((onTime / total) * 100) : null

    // Average rating across all member listings
    const { data: listings } = await admin
      .from('listings')
      .select('avg_rating, review_count')
      .in('seller_id', memberIds)
      .gt('review_count', 0)

    let avgRating: number | null = null
    if (listings && listings.length > 0) {
      const totalWeightedRating = listings.reduce((sum, l) => sum + (l.avg_rating ?? 0) * (l.review_count ?? 1), 0)
      const totalReviews = listings.reduce((sum, l) => sum + (l.review_count ?? 0), 0)
      avgRating = totalReviews > 0 ? Math.round((totalWeightedRating / totalReviews) * 10) / 10 : null
    }

    // Top seller: member with highest OTIF and at least 2 orders
    let topSeller: { name: string; otif: number } | null = null
    let bestOtif = -1
    for (const m of members as MemberRow[]) {
      const uid = m.user_id
      const tot = sellerTotal[uid] ?? 0
      if (tot < 2) continue
      const ot = sellerOnTime[uid] ?? 0
      const sellerOtif = Math.round((ot / tot) * 100)
      if (sellerOtif > bestOtif) {
        bestOtif = sellerOtif
        const p = Array.isArray(m.profile) ? m.profile[0] : m.profile
        const name = p?.full_name || p?.username || 'Unknown'
        topSeller = { name, otif: sellerOtif }
      }
    }

    return NextResponse.json({ otif, total, onTime, late, memberCount, totalOrders, avgRating, topSeller })
  } catch (err) {
    console.error('[GET /api/organisations/[id]/otif]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
