// POST /api/delivery-sessions/geofence
//
// Called by the seller's browser on every GPS position update.
// Checks whether the seller has entered the "near" (1 km) or "arrived"
// (100 m) zone around the buyer's address and fires a push notification
// exactly once per threshold per session (deduped via metadata flags).
//
// This runs server-side so the VAPID private key never leaves the server
// and dedup state is persisted in Postgres rather than per-device memory.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { haversineKm } from '@/lib/geo'
import { sendPushNotification } from '@/lib/push/sendPushNotification'

// Geofence thresholds
const NEAR_KM    = 1.0   // ~5 minutes away at city driving speed
const ARRIVED_KM = 0.1   // 100 m — effectively arrived

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { session_id, seller_lat, seller_lng } = body as {
      session_id?: string
      seller_lat?: number
      seller_lng?: number
    }

    if (!session_id || seller_lat == null || seller_lng == null) {
      return NextResponse.json(
        { error: 'session_id, seller_lat and seller_lng are required' },
        { status: 400 }
      )
    }

    // Fetch the active session — admin client so RLS doesn't block the read
    const admin = createAdminClient()
    const { data: session, error: sessionErr } = await admin
      .from('delivery_sessions')
      .select('id, buyer_id, buyer_lat, buyer_lng, buyer_address, order_id, status, metadata')
      .eq('id', session_id)
      .eq('seller_id', user.id)   // security check: only the seller can call this
      .single()

    if (sessionErr || !session) {
      return NextResponse.json({ error: 'Delivery session not found' }, { status: 404 })
    }
    if (session.status !== 'active') {
      return NextResponse.json({ triggered: false, reason: 'session_not_active' })
    }

    // Buyer must have a recorded geolocation for geofencing to work
    if (session.buyer_lat == null || session.buyer_lng == null) {
      return NextResponse.json({ triggered: false, reason: 'no_buyer_location' })
    }

    const distanceKm = haversineKm(
      { latitude: seller_lat,       longitude: seller_lng },
      { latitude: session.buyer_lat, longitude: session.buyer_lng },
    )

    const meta = (session.metadata ?? {}) as Record<string, boolean>
    const notifications: Array<{ type: string; title: string; message: string }> = []

    // ── "Arrived" threshold (100 m) ──────────────────────────────────
    if (distanceKm <= ARRIVED_KM && !meta.arrived_sent) {
      notifications.push({
        type:    'arrived',
        title:   '📦 Your delivery has arrived!',
        message: 'The seller is at your location. Confirm receipt to release payment.',
      })
      await admin
        .from('delivery_sessions')
        .update({ metadata: { ...meta, arrived_sent: true, near_sent: true } })
        .eq('id', session_id)
    }
    // ── "Near" threshold (1 km) ───────────────────────────────────────
    else if (distanceKm <= NEAR_KM && !meta.near_sent) {
      notifications.push({
        type:    'near',
        title:   '🚗 Delivery arriving soon!',
        message: `Your seller is about ${Math.round(distanceKm * 1000)} m away — roughly 5 minutes.`,
      })
      await admin
        .from('delivery_sessions')
        .update({ metadata: { ...meta, near_sent: true } })
        .eq('id', session_id)
    }

    // Fire push notifications (non-blocking fan-out)
    for (const notif of notifications) {
      sendPushNotification({
        userId:  session.buyer_id,
        title:   notif.title,
        message: notif.message,
        url:     `/orders/${session.order_id}?track=1`,
      }).catch(() => {})
    }

    return NextResponse.json({
      triggered:   notifications.length > 0,
      distance_km: Math.round(distanceKm * 1000) / 1000,
      events:      notifications.map(n => n.type),
    })
  } catch (err) {
    console.error('[geofence] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
