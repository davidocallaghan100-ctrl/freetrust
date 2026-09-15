export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Lists the current user's Rent & Share bookings — both as buyer (requester)
// and as seller (listing owner). Used by:
//   - the buyer-facing "My Bookings" page (app/rent-share/my-bookings)
//   - the owner-facing booking calendar tab inside Earn (app/gig-economy)
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = req.nextUrl.searchParams.get('role') // 'buyer' | 'seller' | null (both)
    if (role && role !== 'buyer' && role !== 'seller') {
      return NextResponse.json({ error: 'role must be buyer or seller' }, { status: 400 })
    }
    const admin = createAdminClient()

    const baseSelect = `
      id, listing_id, requester_id, from_date, to_date, message, status,
      owner_responded_at, checked_in_at, amount, currency, order_id, created_at,
      rent_share_listings ( id, user_id, title, images, price_per_day, price_per_week, price_per_month )
    `

    const results: unknown[] = []

    if (role !== 'seller') {
      const { data, error } = await admin
        .from('rent_share_requests')
        .select(baseSelect)
        .eq('requester_id', user.id)
        .order('created_at', { ascending: false })
      if (error) console.error('[GET /api/rent-share/requests] buyer query error:', error)
      else results.push(...(data ?? []).map(r => ({ ...r, perspective: 'buyer' as const })))
    }

    if (role !== 'buyer') {
      // Owner's incoming requests: filter by listings they own.
      const { data: ownedListings } = await admin
        .from('rent_share_listings')
        .select('id')
        .eq('user_id', user.id)

      const listingIds = (ownedListings ?? []).map(l => l.id as string)
      if (listingIds.length > 0) {
        const { data, error } = await admin
          .from('rent_share_requests')
          .select(baseSelect)
          .in('listing_id', listingIds)
          .order('created_at', { ascending: false })
        if (error) console.error('[GET /api/rent-share/requests] seller query error:', error)
        else results.push(...(data ?? []).map(r => ({ ...r, perspective: 'seller' as const })))
      }
    }

    // Attach order status so owner and buyer surfaces can show pending escrow
    // versus paid without exposing any unrelated order fields.
    const orderIds = Array.from(new Set(
      results
        .filter((r): r is { order_id: string | null } => typeof r === 'object' && r !== null && 'order_id' in r)
        .map(r => r.order_id)
        .filter((id): id is string => Boolean(id))
    ))
    let orderStatuses: Record<string, string> = {}
    if (orderIds.length > 0) {
      const { data: orders, error: ordersErr } = await admin
        .from('orders')
        .select('id, status')
        .in('id', orderIds)
      if (ordersErr) console.error('[GET /api/rent-share/requests] order status query error:', ordersErr)
      orderStatuses = Object.fromEntries((orders ?? []).map(order => [order.id, order.status]))
    }

    // Attach requester profile info for the seller view (avoid N+1 by batching)
    const requesterIds = Array.from(new Set(
      results
        .filter((r): r is { perspective: string; requester_id: string } =>
          typeof r === 'object' && r !== null && 'perspective' in r && (r as { perspective: string }).perspective === 'seller')
        .map(r => (r as { requester_id: string }).requester_id)
    ))
    let requesterProfiles: Record<string, { full_name: string | null; avatar_url: string | null }> = {}
    if (requesterIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', requesterIds)
      requesterProfiles = Object.fromEntries((profiles ?? []).map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]))
    }

    const enriched = results.map(r => {
      const row = r as { perspective: string; requester_id: string; order_id?: string | null }
      const withOrder = {
        ...row,
        order_status: row.order_id ? orderStatuses[row.order_id] ?? null : null,
      }
      if (row.perspective === 'seller') {
        return { ...withOrder, requester: requesterProfiles[row.requester_id] ?? null }
      }
      return withOrder
    })

    return NextResponse.json({ requests: enriched })
  } catch (err) {
    console.error('[GET /api/rent-share/requests]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
