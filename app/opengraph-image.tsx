import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'FreeTrust – Trust-Based Social Commerce'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0f172a',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(56,189,248,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.05) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          display: 'flex',
        }} />

        {/* Glow blobs */}
        <div style={{
          position: 'absolute', top: -120, left: -80,
          width: 480, height: 480,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, transparent 65%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -140, right: -60,
          width: 520, height: 520,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(129,140,248,0.15) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, zIndex: 1 }}>
          {/* Token symbol */}
          <div style={{
            width: 100, height: 100,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #818cf8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 32,
            boxShadow: '0 0 60px rgba(56,189,248,0.4)',
          }}>
            <span style={{ fontSize: 56, fontWeight: 900, color: '#fff', lineHeight: 1 }}>₮</span>
          </div>

          {/* Logo + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
            <span style={{ fontSize: 68, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-2px', lineHeight: 1 }}>
              Free<span style={{ color: '#38bdf8' }}>Trust</span>
            </span>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 28,
            fontWeight: 500,
            color: '#94a3b8',
            marginBottom: 48,
            letterSpacing: '0.2px',
          }}>
            Where Trust is the Currency
          </div>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 16 }}>
            {['🛠 Services', '📦 Products', '🔗 Community', '💎 Trust Economy'].map(label => (
              <div key={label} style={{
                padding: '10px 22px',
                background: 'rgba(56,189,248,0.1)',
                border: '1px solid rgba(56,189,248,0.25)',
                borderRadius: 999,
                fontSize: 20,
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
              }}>
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 5,
          background: 'linear-gradient(90deg, #38bdf8, #818cf8, #34d399)',
          display: 'flex',
        }} />
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
