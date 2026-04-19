'use client'
import { useEffect, useState } from 'react'

interface OTIFData {
  otif: number | null
  total: number
  onTime: number
  late: number
}

interface Props {
  sellerId: string
  compact?: boolean
}

export default function SellerOTIFBadge({ sellerId, compact = false }: Props) {
  const [data, setData] = useState<OTIFData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sellerId) return
    fetch(`/api/sellers/${sellerId}/otif`)
      .then(r => r.json())
      .then((d: OTIFData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sellerId])

  // Only show badge when we have meaningful data (≥2 tracked deliveries)
  if (loading || !data || data.otif === null || data.total < 2) return null

  const color = data.otif >= 90 ? '#10b981' : data.otif >= 70 ? '#f59e0b' : '#ef4444'
  const label = data.otif >= 90 ? '⚡ Top Seller' : data.otif >= 70 ? '📦 Reliable' : '⚠️ Check reviews'

  if (compact) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: `${color}18`, border: `1px solid ${color}40`,
        borderRadius: 12, padding: '2px 8px', fontSize: 11, color, fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {data.otif}% on-time
      </span>
    )
  }

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Delivery Performance
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{data.otif}%</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color }}>{label}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{data.total} deliveries tracked</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#64748b' }}>
        <span>✅ {data.onTime} on time</span>
        <span>·</span>
        <span>⚠️ {data.late} late</span>
      </div>
    </div>
  )
}
