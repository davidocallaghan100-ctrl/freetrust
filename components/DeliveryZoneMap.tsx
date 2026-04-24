'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// ─── Haversine circle polygon (64 points, no external dep) ───────────────────
function computeCirclePolygon(
  lat: number,
  lng: number,
  radiusKm: number
): number[][] {
  const points = 64
  const coords: number[][] = []
  const earthRadius = 6371
  const latR = (lat * Math.PI) / 180
  const lngR = (lng * Math.PI) / 180
  const angularRadius = radiusKm / earthRadius

  for (let i = 0; i <= points; i++) {
    const bearing = (i * 2 * Math.PI) / points
    const pLat = Math.asin(
      Math.sin(latR) * Math.cos(angularRadius) +
        Math.cos(latR) * Math.sin(angularRadius) * Math.cos(bearing)
    )
    const pLng =
      lngR +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(latR),
        Math.cos(angularRadius) - Math.sin(latR) * Math.sin(pLat)
      )
    coords.push([(pLng * 180) / Math.PI, (pLat * 180) / Math.PI])
  }
  return coords
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type DeliveryZoneValue = {
  lat: number
  lng: number
  radiusKm: number
}

interface DeliveryZoneMapProps {
  value: DeliveryZoneValue | null
  onChange?: (value: DeliveryZoneValue) => void
  interactive?: boolean
  height?: number
}

// ─── Mapbox token (reuse existing project token) ─────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// MapLibre can render Mapbox styles — we pass the token via transformRequest
function getMapStyle(): string {
  return 'mapbox://styles/mapbox/streets-v12'
}

// ─── Reverse geocode via Mapbox Geocoding API ─────────────────────────────────
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (!MAPBOX_TOKEN) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood&limit=1`
    )
    const data = await res.json()
    if (data.features?.[0]?.place_name) return data.features[0].place_name as string
  } catch {
    // ignore
  }
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DeliveryZoneMap({
  value,
  onChange,
  interactive = true,
  height = 400,
}: DeliveryZoneMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [radiusKm, setRadiusKm] = useState<number>(value?.radiusKm ?? 25)
  const [placeName, setPlaceName] = useState<string>('')
  const [geoLoading, setGeoLoading] = useState(false)

  // Keep a ref so map event handlers always see the current value without
  // recreating the map on every render.
  const currentValue = useRef<DeliveryZoneValue | null>(value)
  currentValue.current = value

  const currentRadius = useRef<number>(value?.radiusKm ?? 25)
  currentRadius.current = value?.radiusKm ?? radiusKm

  function updateCircle(
    map: maplibregl.Map,
    lat: number,
    lng: number,
    km: number
  ) {
    const coords = computeCirclePolygon(lat, lng, km)
    const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {},
    }
    const src = map.getSource('delivery-circle') as
      | maplibregl.GeoJSONSource
      | undefined
    if (src) {
      src.setData(geojson)
    } else {
      map.addSource('delivery-circle', { type: 'geojson', data: geojson })
      map.addLayer({
        id: 'delivery-circle-fill',
        type: 'fill',
        source: 'delivery-circle',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.15 },
      })
      map.addLayer({
        id: 'delivery-circle-outline',
        type: 'line',
        source: 'delivery-circle',
        paint: { 'line-color': '#3b82f6', 'line-width': 2 },
      })
    }
  }

  function fitToCircle(
    map: maplibregl.Map,
    lat: number,
    lng: number,
    km: number
  ) {
    const earthRadius = 6371
    const angularRadius = km / earthRadius
    const latDelta = (angularRadius * 180) / Math.PI
    const lngDelta = latDelta / Math.cos((lat * Math.PI) / 180)
    map.fitBounds(
      [
        [lng - lngDelta, lat - latDelta],
        [lng + lngDelta, lat + latDelta],
      ],
      { padding: 60, maxZoom: 14, duration: 300 }
    )
  }

  function placeMarker(map: maplibregl.Map, lat: number, lng: number) {
    if (markerRef.current) {
      markerRef.current.setLngLat([lng, lat])
    } else {
      markerRef.current = new maplibregl.Marker({
        color: '#3b82f6',
        draggable: false,
      })
        .setLngLat([lng, lat])
        .addTo(map)
    }
  }

  // ── Mount map once ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: getMapStyle(),
      center: value ? [value.lng, value.lat] : [-7.9, 53.4],
      zoom: value ? 7 : 6,
      interactive,
      transformRequest: (url: string, resourceType?: maplibregl.ResourceType) => {
        // Inject Mapbox token for all Mapbox API requests
        if (MAPBOX_TOKEN && (url.startsWith('https://api.mapbox.com') || url.startsWith('https://events.mapbox.com'))) {
          return {
            url: url.includes('?')
              ? `${url}&access_token=${MAPBOX_TOKEN}`
              : `${url}?access_token=${MAPBOX_TOKEN}`,
          }
        }
        // Resolve mapbox:// sprite/glyphs/tile URLs
        if (MAPBOX_TOKEN && url.startsWith('mapbox://')) {
          const path = url.replace('mapbox://', '')
          return {
            url: `https://api.mapbox.com/${path}${path.includes('?') ? '&' : '?'}access_token=${MAPBOX_TOKEN}`,
          }
        }
        return { url }
      },
    })

    mapRef.current = map

    map.on('load', () => {
      if (value) {
        placeMarker(map, value.lat, value.lng)
        updateCircle(map, value.lat, value.lng, value.radiusKm)
        if (interactive) fitToCircle(map, value.lat, value.lng, value.radiusKm)
        void reverseGeocode(value.lat, value.lng).then(setPlaceName)
      }

      if (interactive && onChange) {
        map.on('click', (e) => {
          const { lat, lng } = e.lngLat
          const km = currentRadius.current
          placeMarker(map, lat, lng)
          updateCircle(map, lat, lng, km)
          fitToCircle(map, lat, lng, km)
          void reverseGeocode(lat, lng).then(setPlaceName)
          onChange({ lat, lng, radiusKm: km })
        })
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Slider handler ───────────────────────────────────────────────────────
  function handleRadiusChange(newRadius: number) {
    setRadiusKm(newRadius)
    currentRadius.current = newRadius
    const v = currentValue.current
    if (!mapRef.current || !v) return
    updateCircle(mapRef.current, v.lat, v.lng, newRadius)
    fitToCircle(mapRef.current, v.lat, v.lng, newRadius)
    if (onChange) onChange({ lat: v.lat, lng: v.lng, radiusKm: newRadius })
  }

  // ── Geolocation button ───────────────────────────────────────────────────
  function useCurrentLocation() {
    if (!navigator.geolocation || !onChange) return
    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const km = currentRadius.current
        const map = mapRef.current
        if (map) {
          placeMarker(map, lat, lng)
          updateCircle(map, lat, lng, km)
          fitToCircle(map, lat, lng, km)
        }
        void reverseGeocode(lat, lng).then(setPlaceName)
        onChange({ lat, lng, radiusKm: km })
        setGeoLoading(false)
      },
      () => setGeoLoading(false)
    )
  }

  const displayRadius = value?.radiusKm ?? radiusKm

  return (
    <div style={{ width: '100%' }}>
      {/* Map canvas */}
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: `${height}px`,
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      />

      {/* Interactive controls */}
      {interactive && (
        <div style={{ marginTop: '16px' }}>
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={geoLoading}
            style={{
              marginBottom: '12px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #374151',
              background: '#1f2937',
              color: '#e5e7eb',
              cursor: geoLoading ? 'wait' : 'pointer',
              fontSize: '14px',
              fontFamily: 'inherit',
              opacity: geoLoading ? 0.6 : 1,
            }}
          >
            {geoLoading ? 'Locating…' : '📍 Use my current location'}
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <input
              type="range"
              min={1}
              max={500}
              step={1}
              value={displayRadius}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#3b82f6' }}
            />
            <span
              style={{
                color: '#9ca3af',
                fontSize: '14px',
                whiteSpace: 'nowrap',
                minWidth: '55px',
                textAlign: 'right',
              }}
            >
              {displayRadius} km
            </span>
          </div>

          <p style={{ marginTop: '8px', color: '#9ca3af', fontSize: '14px' }}>
            {value
              ? `Delivers within ${value.radiusKm} km of ${
                  placeName ||
                  `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`
                }`
              : 'Click the map to set your delivery origin'}
          </p>
        </div>
      )}

      {/* Read-only label */}
      {!interactive && value && (
        <p
          style={{
            marginTop: '10px',
            color: '#9ca3af',
            fontSize: '14px',
          }}
        >
          Delivers within {value.radiusKm} km
          {placeName ? ` of ${placeName}` : ''}
        </p>
      )}
    </div>
  )
}
