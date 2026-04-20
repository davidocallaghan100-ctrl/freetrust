import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
            borderTop: '3px solid #00d4aa',
            animation: 'ft-spin 0.8s linear infinite',
          }} />
          <p style={{ color: '#64748b', fontSize: 13 }}>Loading map…</p>
          <style>{`@keyframes ft-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    ),
  }
)

export default async function MapPage() {
  // Require authentication — unauthenticated users are redirected to login
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/auth/login?redirect=/map')
  }

  return (
    // ft-page-content already adds padding-top: 104px (nav+searchbar).
    // We size to fill the remaining viewport height below that offset.
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      // Height = full viewport minus the nav+searchbar (104px) that
      // ft-page-content's padding-top already accounts for.
      height: 'calc(100vh - 104px)',
      overflow: 'hidden',
      background: '#0a0a0f',
      color: '#f1f5f9',
    }}>
      {/* ── Compact header ── */}
      <div style={{
        padding: '10px 16px 8px',
        flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid rgba(42,42,58,0.6)',
        background: 'rgba(10,10,15,0.6)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #38bdf8, #00d4aa)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, boxShadow: '0 2px 10px rgba(56,189,248,0.3)',
        }}>🗺️</div>
        <div>
          <h1 style={{
            margin: 0, fontSize: 16, fontWeight: 700, lineHeight: 1.2,
            background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Activity Map</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#64748b', lineHeight: 1.2 }}>
            Members · Events · Products · Services · Jobs
          </p>
        </div>
      </div>

      {/* ── Map (fills remaining height) ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <ActivityMap />
      </div>
    </div>
  )
}
