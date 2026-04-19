'use client'
import { useEffect, useState } from 'react'

interface OrgTrustData {
  otif: number | null
  total: number
  onTime: number
  late: number
  memberCount: number
  totalOrders: number
  avgRating: number | null
  topSeller: { name: string; otif: number } | null
}

interface Props {
  orgId: string
}

export default function OrgTrustSummary({ orgId }: Props) {
  const [data, setData] = useState<OrgTrustData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/organisations/${orgId}/otif`)
      .then(r => r.json())
      .then((d: OrgTrustData) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [orgId])

  if (loading) return null
  if (!data || data.totalOrders < 2) return null

  const otifColor = data.otif === null ? '#64748b'
    : data.otif >= 90 ? '#10b981'
    : data.otif >= 70 ? '#f59e0b'
    : '#ef4444'

  const otifLabel = data.otif === null ? 'No data'
    : data.otif >= 90 ? '⚡ Excellent'
    : data.otif >= 70 ? '📦 Good'
    : '⚠️ Needs improvement'

  return (
    <div style={{
      background: 'rgba(15,23,42,0.6)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 20,
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#64748b',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 16,
      }}>
        Organisation Performance
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${data.avgRating !== null ? 3 : 2}, 1fr)`,
        gap: 16,
        marginBottom: 14,
      }}>
        {/* OTIF Score */}
        {data.otif !== null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: otifColor, lineHeight: 1 }}>
              {data.otif}%
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>On-time delivery</div>
            <div style={{ fontSize: 10, color: otifColor, marginTop: 2, fontWeight: 600 }}>{otifLabel}</div>
          </div>
        )}

        {/* Avg Rating */}
        {data.avgRating !== null && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>
              ★ {data.avgRating.toFixed(1)}
            </div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Average rating</div>
          </div>
        )}

        {/* Total Orders */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 30, fontWeight: 800, color: '#f8fafc', lineHeight: 1 }}>
            {data.totalOrders}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Orders fulfilled</div>
        </div>
      </div>

      {/* Stats footer */}
      <div style={{
        paddingTop: 14,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 12,
        color: '#64748b',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
      }}>
        <span>👥 {data.memberCount} member{data.memberCount !== 1 ? 's' : ''}</span>
        {data.total > 0 && (
          <>
            <span>·</span>
            <span>✅ {data.onTime} on time</span>
            {data.late > 0 && <><span>·</span><span>⚠️ {data.late} late</span></>}
          </>
        )}
        {data.topSeller && (
          <>
            <span>·</span>
            <span>🏆 Top: <strong style={{ color: '#f8fafc' }}>{data.topSeller.name}</strong> ({data.topSeller.otif}%)</span>
          </>
        )}
      </div>
    </div>
  )
}
