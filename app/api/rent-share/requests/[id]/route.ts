export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'
import { computeRentalAmount } from '@/lib/rentShare/pricing'

type Action = 'approve' | 'decline' | 'cancel' | 'check_in'

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const action = body?.action as Action | undefined
    if (!action || !['approve', 'decline', 'cancel', 'check_in'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: bookingRequest, error: reqErr } = await admin
      .from('rent_share_requests')
      .select(`
        id, listing_id, requester_id, from_date, to_date, status, amount, currency, order_id,
        rent_share_listings ( id, user_id, title, price_per_day, price_per_week, price_per_month )
      `)
      .eq('id', requestId)
      .single()

    if (reqErr || !bookingRequest) {
      return NextResponse.json({ error: 'Booking request not found' }, { status: 404 })
    }

    const listing = Array.isArray(bookingRequest.rent_share_listings)
      ? bookingRequest.rent_share_listings[0]
      : bookingRequest.rent_share_listings
    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }

    const isOwner = listing.user_id === user.id
    const isRequester = bookingRequest.requester_id === user.id

    // ── Owner actions ──────────────────────────────────────────────────────
    if (action === 'approve' || action === 'decline') {
      if (!isOwner) return NextResponse.json({ error: 'Only the listing owner can respond to this request' }, { status: 403 })
      if (bookingRequest.status !== 'pending') {
        return NextResponse.json({ error: `Cannot ${action} a request with status "${bookingRequest.status}"` }, { status: 409 })
      }

      if (action === 'decline') {
        const { data: declinedRequest, error: updErr } = await admin
          .from('rent_share_requests')
          .update({ status: 'declined', owner_responded_at: new Date().toISOString() })
          .eq('id', requestId)
          .eq('status', 'pending')
          .select('id')
          .maybeSingle()
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        if (!declinedRequest) return NextResponse.json({ error: 'Request was already updated' }, { status: 409 })

        await insertNotification({
          userId: bookingRequest.requester_id,
          type: 'rent_declined',
          title: `❌ Booking request declined`,
          body: `Your request for "${listing.title}" was declined.`,
          link: '/rent-share/my-bookings',
        })

        return NextResponse.json({ ok: true, status: 'declined' })
      }

      // approve: compute amount, create escrow order, link it
      const breakdown = computeRentalAmount(listing, bookingRequest.from_date, bookingRequest.to_date)
      if (breakdown.rateUsed === 'none' || breakdown.amount <= 0) {
        return NextResponse.json({ error: 'This listing has no pricing set — cannot approve a booking without a price.' }, { status: 422 })
      }

      // Re-check overlap immediately before approval. The request endpoint
      // blocks overlaps at creation time, but this second check protects the
      // owner from approving stale/conflicting requests that were created by
      // an older client or during a concurrent request race.
      const { data: activeBookings, error: overlapErr } = await admin
        .from('rent_share_requests')
        .select('id, from_date, to_date, status')
        .eq('listing_id', listing.id)
        .neq('id', requestId)
        .in('status', ['approved', 'completed'])
      if (overlapErr) {
        console.error('[PATCH rent-share/requests approve] overlap query error:', overlapErr)
        return NextResponse.json({ error: 'Could not verify booking availability' }, { status: 500 })
      }
      if ((activeBookings ?? []).some(existing => existing.from_date < bookingRequest.to_date && bookingRequest.from_date < existing.to_date)) {
        return NextResponse.json({ error: 'Those dates overlap an existing booking' }, { status: 409 })
      }

      if (bookingRequest.order_id) {
        return NextResponse.json({ error: 'This request already has a payment order' }, { status: 409 })
      }

      const { data: order, error: orderErr } = await admin
        .from('orders')
        .insert({
          buyer_id: bookingRequest.requester_id,
          seller_id: listing.user_id,
          listing_id: listing.id,
          title: `Rent & Share: ${listing.title}`,
          amount: breakdown.amount,
          currency: 'EUR',
          status: 'pending_escrow',
          // The live orders constraint allows in_person, not a custom rental
          // value. The booking metadata is carried in notes/listing_id.
          delivery_type: 'in_person',
          notes: `Rent & Share booking ${bookingRequest.from_date} → ${bookingRequest.to_date} (${breakdown.nights} nights)`,
          total_eur: breakdown.amount,
        })
        .select('id')
        .single()

      if (orderErr || !order) {
        console.error('[PATCH rent-share/requests approve] order insert error:', orderErr)
        return NextResponse.json({ error: 'Failed to create escrow order' }, { status: 500 })
      }

      const { data: approvedRequest, error: updErr } = await admin
        .from('rent_share_requests')
        .update({
          status: 'approved',
          owner_responded_at: new Date().toISOString(),
          amount: breakdown.amount,
          currency: 'EUR',
          order_id: order.id,
        })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()

      if (updErr || !approvedRequest) {
        // The guarded update lost a race (or failed after the order insert).
        // Cancel the newly-created pending escrow order so it cannot appear as
        // an orphaned payout in the wallet ledger.
        await admin.from('orders').update({ status: 'cancelled' }).eq('id', order.id).eq('status', 'pending_escrow')
        if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
        return NextResponse.json({ error: 'Request was already updated' }, { status: 409 })
      }

      await insertNotification({
        userId: bookingRequest.requester_id,
        type: 'rent_approved',
        title: `✅ Booking approved!`,
        body: `Your request for "${listing.title}" was approved. Total: €${breakdown.amount.toFixed(2)}. Confirm check-in when you arrive to release payment.`,
        link: `/rent-share/my-bookings`,
      })

      return NextResponse.json({ ok: true, status: 'approved', amount: breakdown.amount, order_id: order.id })
    }

    // ── Requester actions ──────────────────────────────────────────────────
    if (action === 'cancel') {
      if (!isRequester) return NextResponse.json({ error: 'Only the requester can cancel this request' }, { status: 403 })
      if (bookingRequest.status !== 'pending' && bookingRequest.status !== 'approved') {
        return NextResponse.json({ error: `Cannot cancel a request with status "${bookingRequest.status}"` }, { status: 409 })
      }

      // If an escrow order was created, cancel it first so the request cannot
      // be marked cancelled while a pending payout order is left behind.
      if (bookingRequest.order_id) {
        const { data: cancelledOrder, error: cancelOrderErr } = await admin
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', bookingRequest.order_id)
          .eq('status', 'pending_escrow')
          .select('id')
          .maybeSingle()
        if (cancelOrderErr) return NextResponse.json({ error: cancelOrderErr.message }, { status: 500 })
        if (!cancelledOrder) return NextResponse.json({ error: 'This booking payment is no longer cancellable' }, { status: 409 })
      }

      const { data: cancelledRequest, error: updErr } = await admin
        .from('rent_share_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .in('status', ['pending', 'approved'])
        .select('id')
        .maybeSingle()
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
      if (!cancelledRequest) return NextResponse.json({ error: 'Request was already updated' }, { status: 409 })

      await insertNotification({
        userId: listing.user_id,
        type: 'rent_cancelled',
        title: `Booking request cancelled`,
        body: `The requester cancelled their booking for "${listing.title}".`,
        link: `/gig-economy?tab=bookings`,
      })

      return NextResponse.json({ ok: true, status: 'cancelled' })
    }

    if (action === 'check_in') {
      if (!isRequester) return NextResponse.json({ error: 'Only the buyer can confirm check-in' }, { status: 403 })
      if (bookingRequest.status !== 'approved' && bookingRequest.status !== 'completed') {
        return NextResponse.json({ error: `Cannot check in a request with status "${bookingRequest.status}"` }, { status: 409 })
      }
      const today = todayDateOnly()
      if (bookingRequest.status === 'approved') {
        if (today < bookingRequest.from_date) {
          return NextResponse.json({ error: `Check-in opens on ${bookingRequest.from_date}` }, { status: 409 })
        }
        if (today >= bookingRequest.to_date) {
          return NextResponse.json({ error: 'The check-in window for this booking has passed' }, { status: 409 })
        }
      }
      if (!bookingRequest.order_id || !bookingRequest.amount) {
        return NextResponse.json({ error: 'Booking is missing payment details' }, { status: 500 })
      }

      // The database function locks the buyer, checks the live wallet ledger,
      // completes the order, and updates the booking in one transaction. It is
      // also safe to retry after a network timeout.
      const { data: payoutRows, error: payoutErr } = await admin.rpc('rent_share_check_in', {
        p_request_id: requestId,
        p_requester_id: user.id,
      })

      if (payoutErr) {
        console.error('[PATCH rent-share/requests check_in] payout error:', payoutErr)
        if (payoutErr.message?.toLowerCase().includes('insufficient wallet balance')) {
          return NextResponse.json({ error: 'Insufficient balance to check in. Top up your wallet first.' }, { status: 402 })
        }
        if (payoutErr.code === 'P0001' || payoutErr.code === 'P0002' || payoutErr.code === '42501') {
          return NextResponse.json({ error: payoutErr.message }, { status: 409 })
        }
        return NextResponse.json({ error: 'Could not release booking payment' }, { status: 500 })
      }

      const payout = Array.isArray(payoutRows) ? payoutRows[0] : payoutRows
      if (!payout) return NextResponse.json({ error: 'Could not confirm booking payment' }, { status: 500 })

      if (payout.is_replay) {
        return NextResponse.json({ ok: true, status: 'completed', replay: true })
      }

      await insertNotification({
        userId: listing.user_id,
        type: 'rent_checkin_payout',
        title: `💰 Payout received!`,
        body: `€${Number(bookingRequest.amount).toFixed(2)} for "${listing.title}" has been added to your wallet — guest checked in.`,
        link: '/gig-economy?tab=payments',
      })
      await insertNotification({
        userId: bookingRequest.requester_id,
        type: 'rent_completed',
        title: `🏁 Check-in confirmed`,
        body: `€${Number(bookingRequest.amount).toFixed(2)} released for "${listing.title}". Enjoy your stay!`,
        link: '/rent-share/my-bookings',
      })

      return NextResponse.json({ ok: true, status: 'completed' })
    }

    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 })
  } catch (err) {
    console.error('[PATCH /api/rent-share/requests/[id]]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
