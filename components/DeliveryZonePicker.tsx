'use client'

import { useEffect, useRef } from 'react'
import DeliveryZoneMap, { DeliveryZoneValue } from './DeliveryZoneMap'

interface DeliveryZonePickerProps {
  value: DeliveryZoneValue | null
  onChange: (value: DeliveryZoneValue) => void
}

export default function DeliveryZonePicker({
  value,
  onChange,
}: DeliveryZonePickerProps) {
  // When the user selects "Local" the picker is revealed inside a scroll
  // container that's usually already scrolled down. Bring ourselves into
  // view so the map (and the tap-to-set-origin instruction) is visible —
  // otherwise a short screen gives the impression the map never loaded.
  const wrapperRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = wrapperRef.current
    if (!node) return
    // Slight delay so the layout settles before we scroll; avoids fighting
    // a concurrent reflow on mobile Safari.
    const t = window.setTimeout(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div ref={wrapperRef} style={{ width: '100%' }}>
      <DeliveryZoneMap
        value={value}
        onChange={onChange}
        interactive={true}
        height={400}
      />
    </div>
  )
}
