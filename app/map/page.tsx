import { createClient } from '@/lib/supabase/server'
import dynamic from 'next/dynamic'

// Load the map client-side only (mapbox-gl requires browser APIs)
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

const PIN_TYPES = [
  { color: '#00d4aa', label: 'Members' },
  { color: '#f59e0b', label: 'Events' },
  { color: '#a855f7', label: 'Products' },
  { color: '#f97316', label: 'Services' },
  { color: '#38bdf8', label: 'Jobs' },
]

export default async function MapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // ── Unauthenticated: show teaser with sign-in / sign-up CTAs ──────────────
  if (!user) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 104px)',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        textAlign: 'center',
      }}>
        {/* Globe icon */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0d2b5e, #1d7a35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 40, marginBottom: 24,
          boxShadow: '0 0 40px rgba(0,212,170,0.3), 0 0 80px rgba(56,189,248,0.15)',
          border: '1px solid rgba(0,212,170,0.3)',
        }}>🌍</div>

        {/* Heading */}
        <h1 style={{
          fontSize: 28, fontWeight: 800, margin: '0 0 12px',
          background: 'linear-gradient(135deg, #f1f5f9, #00d4aa)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.2,
        }}>Discover Your Community</h1>

        <p style={{
          fontSize: 15, color: '#94a3b8', margin: '0 0 8px', maxWidth: 320, lineHeight: 1.6,
        }}>
          See members, events, services, products and jobs near you on the FreeTrust Activity Map.
        </p>

        {/* Pin type previews */}
        <div style={{
          display: 'flex', gap: 10, margin: '20px 0 32px', flexWrap: 'wrap', justifyContent: 'center',
        }}>
          {PIN_TYPES.map(({ color, label }) => (
            <span key={label} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 12px', borderRadius: 20,
              background: `${color}18`, border: `1px solid ${color}44`,
              fontSize: 12, color, fontWeight: 600,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: color, display: 'inline-block', flexShrink: 0,
              }} />
              {label}
            </span>
          ))}
        </div>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <a href="/login?redirect=/map" style={{
            display: 'block', padding: '14px 24px', borderRadius: 12,
            background: 'linear-gradient(135deg, #00d4aa, #38bdf8)',
            color: '#0a0a0f', fontWeight: 700, fontSize: 15,
            textDecoration: 'none', textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,212,170,0.4)',
          }}>Sign in to explore the map</a>

          <a href="/register" style={{
            display: 'block', padding: '14px 24px', borderRadius: 12,
            background: 'transparent',
            border: '1.5px solid #2a2a3a',
            color: '#f1f5f9', fontWeight: 600, fontSize: 15,
            textDecoration: 'none', textAlign: 'center',
          }}>Create a free account →</a>
        </div>

        <p style={{ margin: '24px 0 0', fontSize: 12, color: '#475569' }}>
          Join 25+ freelancers already on FreeTrust
        </p>
      </div>
    )
  }

  // ── Authenticated: render the full map ────────────────────────────────────
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
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
