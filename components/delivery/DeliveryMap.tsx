'use client'
import { useEffect, useRef, useState } from 'react'

interface DeliveryMapProps {
  sellerLat: number
  sellerLng: number
  buyerLat: number
  buyerLng: number
  etaMinutes?: number
}

// OSRM route fetcher
async function fetchRoute(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number
): Promise<{ coords: [number, number][]; durationMinutes: number } | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    const data = await res.json()
    if (data.code !== 'Ok' || !data.routes[0]) return null
    const coords = data.routes[0].geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    )
    const durationMinutes = Math.ceil(data.routes[0].duration / 60)
    return { coords, durationMinutes }
  } catch {
    return null
  }
}

export default function DeliveryMap({ sellerLat, sellerLng, buyerLat, buyerLng, etaMinutes }: DeliveryMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletMapRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sellerMarkerRef = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLayerRef = useRef<any>(null)
  const [eta, setEta] = useState<number | null>(etaMinutes ?? null)

  useEffect(() => {
    if (!mapRef.current || leafletMapRef.current) return

    // Dynamic import Leaflet (client-only)
    import('leaflet').then((L) => {
      // Fix default icon paths (common Leaflet/webpack issue)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      // Seller marker (truck emoji via DivIcon)
      const truckIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🚚</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })

      // Buyer marker (home emoji)
      const homeIcon = L.divIcon({
        html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">📍</div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      })

      const sellerMarker = L.marker([sellerLat, sellerLng], { icon: truckIcon }).addTo(map)
      L.marker([buyerLat, buyerLng], { icon: homeIcon }).addTo(map)

      sellerMarkerRef.current = sellerMarker
      leafletMapRef.current = map

      // Fit bounds to show both markers
      map.fitBounds([[sellerLat, sellerLng], [buyerLat, buyerLng]], { padding: [40, 40] })

      // Fetch and draw route
      fetchRoute(sellerLat, sellerLng, buyerLat, buyerLng).then((route) => {
        if (!route) return
        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current)
        routeLayerRef.current = L.polyline(route.coords, {
          color: '#10b981',
          weight: 4,
          opacity: 0.8,
        }).addTo(map)
        setEta(route.durationMinutes)
      })
    })

    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update seller position when coordinates change
  useEffect(() => {
    if (!leafletMapRef.current || !sellerMarkerRef.current) return
    import('leaflet').then((L) => {
      sellerMarkerRef.current.setLatLng([sellerLat, sellerLng])
      // Re-fetch route on significant position change
      fetchRoute(sellerLat, sellerLng, buyerLat, buyerLng).then((route) => {
        if (!route || !leafletMapRef.current) return
        if (routeLayerRef.current) leafletMapRef.current.removeLayer(routeLayerRef.current)
        routeLayerRef.current = L.polyline(route.coords, {
          color: '#10b981',
          weight: 4,
          opacity: 0.8,
        }).addTo(leafletMapRef.current)
        setEta(route.durationMinutes)
      })
    })
  }, [sellerLat, sellerLng, buyerLat, buyerLng])

  return (
    <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* ETA Banner */}
      {eta !== null && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(16,185,129,0.3)', borderRadius: 20,
          padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8,
          color: '#f8fafc', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap',
        }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s ease-in-out infinite' }} />
          📡 Live · ~{eta} min away
        </div>
      )}
      {/* Map container */}
      <div ref={mapRef} style={{ height: 320, width: '100%', background: '#1e293b' }} />
      {/* Leaflet CSS */}
      <style>{`
        @import url('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  )
}
