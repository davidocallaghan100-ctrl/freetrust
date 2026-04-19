'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface DeliveryPosition {
  lat: number
  lng: number
  timestamp: number
}

export interface DeliverySession {
  id: string
  status: 'active' | 'completed' | 'cancelled'
  buyer_lat: number | null
  buyer_lng: number | null
  buyer_address: string | null
  last_seller_lat: number | null
  last_seller_lng: number | null
}

// ─── SELLER HOOK ────────────────────────────────────────────────────────────
// Broadcasts GPS position updates to the buyer via Supabase Realtime

export function useSellerTracking(orderId: string, sessionId: string | null) {
  const [isTracking, setIsTracking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const supabase = createClient()

  const startTracking = useCallback(() => {
    if (!sessionId) return

    setIsTracking(true)
    setError(null)

    const channel = supabase.channel(`delivery:${orderId}`, {
      config: { broadcast: { self: false } },
    })
    channel.subscribe()

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const payload: DeliveryPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: Date.now(),
        }
        // Broadcast to buyer
        channel.send({ type: 'broadcast', event: 'position', payload })
        // DB fallback (for buyers who connect late)
        supabase
          .from('delivery_sessions')
          .update({
            last_seller_lat: payload.lat,
            last_seller_lng: payload.lng,
            last_ping_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .then(() => {})
        // Geofence check — fires push notifications at 1 km and 100 m from buyer
        fetch('/api/delivery-sessions/geofence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            seller_lat: payload.lat,
            seller_lng: payload.lng,
          }),
        }).catch(() => {})
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 5000 }
    )

    const cleanup = () => {
      navigator.geolocation.clearWatch(watchId)
      supabase.removeChannel(channel)
      setIsTracking(false)
    }

    cleanupRef.current = cleanup
    return cleanup
  }, [orderId, sessionId, supabase])

  const stopTracking = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }, [])

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current()
    }
  }, [])

  return { isTracking, error, startTracking, stopTracking }
}

// ─── BUYER HOOK ─────────────────────────────────────────────────────────────
// Subscribes to real-time position broadcasts from the seller

export function useBuyerTracking(orderId: string) {
  const [sellerPosition, setSellerPosition] = useState<DeliveryPosition | null>(null)
  const [session, setSession] = useState<DeliverySession | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Fetch current active delivery session
    supabase
      .from('delivery_sessions')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'active')
      .single()
      .then(({ data }) => {
        setSession(data as DeliverySession | null)
        setLoading(false)
      })
  }, [orderId, supabase])

  useEffect(() => {
    if (!session) return

    // Seed with last known DB position (in case realtime missed some updates)
    if (session.last_seller_lat && session.last_seller_lng) {
      setSellerPosition({
        lat: session.last_seller_lat,
        lng: session.last_seller_lng,
        timestamp: Date.now(),
      })
    }

    // Subscribe to real-time position broadcasts
    const channel = supabase.channel(`delivery:${orderId}`)
    channel
      .on('broadcast', { event: 'position' }, ({ payload }) => {
        setSellerPosition(payload as DeliveryPosition)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orderId, session, supabase])

  return { sellerPosition, session, loading }
}
