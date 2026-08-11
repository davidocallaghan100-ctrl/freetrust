'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import type { StyleSpecification } from 'maplibre-gl'
// NOTE: the maplibre stylesheet is also imported globally in app/layout.tsx
// so the canvas always has sizing rules at mount time (mobile Safari needs
// the stylesheet to be present before the map initialises or the canvas
// ends up 0×0). Keeping this import here too is harmless — CSS modules
// dedupe — and makes this component self-contained for unit tests.
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

// ─── Map/geocoding config ────────────────────────────────────────────────────
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// Product delivery-zone picking must not depend on a project Mapbox style or a
// third-party JSON style endpoint. A single invalid token/style fetch previously
// caused MapLibre to render only the watermark plus the "Map couldn't load"
// overlay on mobile. Use a tiny inline raster style with public Carto tiles so
// the picker has a stable, no-key basemap; keep Mapbox only for optional reverse
// geocoding below.
const CARTO_DARK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 20,
    },
  ],
}

function getMapStyle(): StyleSpecification {
  return CARTO_DARK_RASTER_STYLE
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
  // Track map lifecycle so we can render a visible loading/fallback state
  // while tiles fetch (mobile) and so a style-fetch failure doesn't leave
  // the user staring at an empty black rectangle.
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const loadedRef = useRef(false)

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
    })

    mapRef.current = map

    loadedRef.current = false

    // Log non-fatal tile errors for diagnostics, but don't hide the map for a
    // single failed tile/glyph request. The fatal fallback below only appears
    // if the map never reaches its load event.
    map.on('error', (e) => {
      console.warn('[DeliveryZoneMap] map warning:', e.error?.message ?? e)
    })

    const loadTimeout = window.setTimeout(() => {
      if (!loadedRef.current) setMapError('Map timed out before loading')
    }, 10000)

    map.on('load', () => {
      loadedRef.current = true
      window.clearTimeout(loadTimeout)
      setMapError(null)
      setMapReady(true)
      // Mobile Safari frequently mounts the canvas at 0×0 when the map is
      // inside a just-revealed conditional (e.g. "Local" radio click). Force
      // a resize on load and again on the next frame to guarantee the canvas
      // picks up its container dimensions.
      map.resize()
      requestAnimationFrame(() => map.resize())

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

    // Extra safety: if the container element's size changes after mount
    // (mobile accordion reveal, orientation change, keyboard dismiss) keep
    // the canvas in sync.
    const ro = new ResizeObserver(() => {
      try { map.resize() } catch { /* map already removed */ }
    })
    ro.observe(mapContainer.current)

    return () => {
      window.clearTimeout(loadTimeout)
      ro.disconnect()
      map.remove()
      mapRef.current = null
      markerRef.current = null
      loadedRef.current = false
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
      {/* Map canvas — positioned wrapper so we can overlay loading/error
          states without the canvas losing its dimensions. `minHeight` and
          explicit `height` protect against the mobile Safari 0×0 bug when
          this map is revealed inside a conditional. */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: `${height}px`,
          minHeight: `${height}px`,
          borderRadius: '12px',
          overflow: 'hidden',
          background: 'var(--ft-bg)',
          border: '1px solid #1f2937',
        }}
      >
        <div
          ref={mapContainer}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
        {!mapReady && !mapError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
              fontSize: 14,
              pointerEvents: 'none',
              background:
                'linear-gradient(90deg, rgba(30,41,59,0.4) 0%, rgba(51,65,85,0.4) 50%, rgba(30,41,59,0.4) 100%)',
              backgroundSize: '200% 100%',
              animation: 'dzm-shimmer 1.4s linear infinite',
            }}
          >
            Loading map…
          </div>
        )}
        {mapError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: '#fca5a5',
              fontSize: 13,
              padding: 16,
              gap: 6,
            }}
          >
            <span>⚠️ Map couldn&apos;t load</span>
            <span style={{ color: 'var(--ft-text-secondary)', fontSize: 12 }}>
              Check your connection, or use your current location below.
            </span>
          </div>
        )}
        <style>{`@keyframes dzm-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>

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
