import dynamic from 'next/dynamic'

// Load the map client-side only (maplibre-gl requires browser APIs)
const ActivityMap = dynamic(
  () => import('@/components/map/ActivityMap'),
  {
    ssr: false,
    loading: () => (
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f',
        minHeight: '60vh',
      }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '3px solid #1e1e2e',
            borderTop: '3px solid #6c63ff',
            animation: 'ft-spin 0.8s linear infinite',
          }} />
          <p style={{ color: '#64748b', fontSize: 13 }}>Loading map…</p>
          <style>{`@keyframes ft-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
)

export default function MapPage() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#f1f5f9',
    }}>
      {/* ── Header ── */}
      <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          {/* Icon circle */}
          <div style={{
            width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #6c63ff, #00d4aa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 4px 16px rgba(108,99,255,0.35)',
          }}>
            🗺️
          </div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 24, fontWeight: 700,
              background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Activity Map
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              Discover members, events, products &amp; jobs near you
            </p>
          </div>
        </div>
        {/* Divider */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, #6c63ff44, #00d4aa22, transparent)',
          marginBottom: 0,
        }} />
      </div>

      {/* ── Map (fills remaining height) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ActivityMap />
      </div>
    </div>
  )
}
