'use client'

import DeliveryZoneMap, { DeliveryZoneValue } from './DeliveryZoneMap'

interface DeliveryZonePickerProps {
  value: DeliveryZoneValue | null
  onChange: (value: DeliveryZoneValue) => void
}

export default function DeliveryZonePicker({
  value,
  onChange,
}: DeliveryZonePickerProps) {
  return (
    <div style={{ width: '100%' }}>
      <DeliveryZoneMap
        value={value}
        onChange={onChange}
        interactive={true}
        height={400}
      />
    </div>
  )
}
