'use client'
import React, { useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────
// EventsMap
// ────────────────────────────────────────────────────────────────────────────
// Drop-in Leaflet map for the /events browse page. Loads leaflet.js +
// leaflet.css from unpkg on demand — no npm install needed, and the rest
// of the app is unaffected.
//
// The middleware CSP has been updated to allow:
//   * https://unpkg.com              (Leaflet JS + CSS)
//   * https://tile.openstreetmap.org (OSM raster tiles)
//
// Props:
//   events — array of {id, title, latitude, longitude, starts_at, city}
//   height — pixel height of the map container (default 420)
//   center — optional initial center; defaults to event centroid or Europe
//
// Each event with valid coordinates becomes a marker. Clicking a marker
// opens a popup with the title, date, location, and a "View event" link.

// Minimal Leaflet type surface we actually use. Keeping it local avoids
// adding @types/leaflet as a devDependency just to satisfy the compiler.
/* eslint-disable @typescript-eslint/no-explicit-any */
type LeafletMap = any
type LeafletMarker = any

declare global {
  interface Window {
    L?: {
      map: (el: HTMLElement, options?: object) => LeafletMap
      tileLayer: (url: string, options?: object) => { addTo: (m: LeafletMap) => unknown }
      marker: (pos: [number, number], options?: object) => LeafletMarker
      divIcon: (options: object) => object
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface MapEvent {
  id: string
  title: string
  latitude: number | null
  longitude: number | null
  starts_at?: string | null
  city?: string | null
  location_label?: string | null
}

export interface EventsMapProps {
  events: MapEvent[]
  height?: number
  center?: { lat: number; lng: number; zoom?: number }
}

export default function EventsMap({ events, height = 420, center }: EventsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const markersRef = useRef<LeafletMarker[]>([])
  const [scriptReady, setScriptReady] = useState(false)

  // Mount / unmount the map
  useEffect(() => {
    if (!scriptReady || !containerRef.current || !window.L) return
    if (mapRef.current) return

    const geoEvents = events.filter(
      e => typeof e.latitude === 'number' && typeof e.longitude === 'number'
    )

    // Determine initial center: explicit > centroid of events > Europe
    let initialCenter: [number, number] = [50, 10]
    let initialZoom = 4
    if (center) {
      initialCenter = [center.lat, center.lng]
      initialZoom = center.zoom ?? 8
    } else if (geoEvents.length > 0) {
      const lat = geoEvents.reduce((s, e) => s + (e.latitude ?? 0), 0) / geoEvents.length
      const lng = geoEvents.reduce((s, e) => s + (e.longitude ?? 0), 0) / geoEvents.length
      initialCenter = [lat, lng]
      initialZoom = geoEvents.length === 1 ? 10 : 5
    }

    const map = window.L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      scrollWheelZoom: false,
    })
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(mapRef.current as any)?.remove?.()
      mapRef.current = null
      markersRef.current = []
    }
    // Only re-run when the map script becomes ready or when explicit
    // center changes. Event markers are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, center?.lat, center?.lng])

  // Rebuild markers whenever the event list changes
  useEffect(() => {
    if (!mapRef.current || !window.L) return
    // Remove old markers
    for (const m of markersRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(m as any).remove?.()
    }
    markersRef.current = []

    for (const e of events) {
      if (typeof e.latitude !== 'number' || typeof e.longitude !== 'number') continue
      const icon = window.L.divIcon({
        className: 'ft-event-marker',
        html: '<div style="background:#38bdf8;color:#0f172a;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid #0f172a">📅</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      })
      const marker = window.L.marker([e.latitude, e.longitude], { icon }).addTo(mapRef.current)
      const dateStr = e.starts_at ? new Date(e.starts_at).toLocaleDateString() : ''
      const city = e.location_label ?? e.city ?? ''
      marker.bindPopup(
        `<div style="font-family:system-ui;min-width:180px">
          <div style="font-weight:700;color:#0f172a;font-size:13px;margin-bottom:4px">${escapeHtml(e.title)}</div>
          ${dateStr ? `<div style="font-size:11px;color:#475569;margin-bottom:2px">🗓 ${escapeHtml(dateStr)}</div>` : ''}
          ${city ? `<div style="font-size:11px;color:#475569;margin-bottom:6px">📍 ${escapeHtml(city)}</div>` : ''}
          <a href="/events/${encodeURIComponent(e.id)}" style="color:#0284c7;font-size:12px;font-weight:600;text-decoration:none">View event →</a>
        </div>`
      )
      markersRef.current.push(marker)
    }
  }, [events])

  return (
    <>
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={containerRef}
        role="application"
        aria-label="Events map"
        style={{
          width: '100%',
          height,
          borderRadius: 12,
          overflow: 'hidden',
          background: '#0b1120',
          border: '1px solid rgba(56,189,248,0.15)',
        }}
      />
      {/* If there are no geo events, surface a helpful message on top */}
      {events.every(e => typeof e.latitude !== 'number' || typeof e.longitude !== 'number') && (
        <div style={{
          marginTop: 8, fontSize: 12, color: '#64748b', textAlign: 'center',
        }}>
          No events have map coordinates yet — browse by list view or
          create an event with a location to pin it here.{' '}
          <Link href="/create?type=event" style={{ color: '#38bdf8' }}>Create event</Link>
        </div>
      )}
    </>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
