import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// GET /og-image.png — branded social share image (1200x630, served at the
// exact URL the user specified so deep-links and external references stay
// stable). Generated on demand by next/og — no binary file is committed.
//
// Brand: dark navy #0a1628 background, sky blue #00b4d8 accents.
export async function GET() {
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
          background: '#0a1628',
          position: 'relative',
          overflow: 'hidden',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(0,180,216,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,180,216,0.06) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          display: 'flex',
        }} />

        {/* Glow accents */}
        <div style={{
          position: 'absolute', top: -160, left: -120,
          width: 540, height: 540,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,180,216,0.22) 0%, transparent 65%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute', bottom: -180, right: -100,
          width: 600, height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,180,216,0.16) 0%, transparent 65%)',
          display: 'flex',
        }} />

        {/* Main content stack */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
          {/* Trust token mark */}
          <div style={{
            width: 110, height: 110,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00b4d8 0%, #0096c7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 36,
            boxShadow: '0 0 80px rgba(0,180,216,0.55)',
          }}>
            <span style={{ fontSize: 62, fontWeight: 900, color: '#0a1628', lineHeight: 1 }}>₮</span>
          </div>

          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
            <span style={{ fontSize: 78, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-2.5px', lineHeight: 1 }}>
              Free<span style={{ color: '#00b4d8' }}>Trust</span>
            </span>
          </div>

          {/* Tagline */}
          <div style={{
            fontSize: 30,
            fontWeight: 500,
            color: '#94a3b8',
            marginBottom: 56,
            letterSpacing: '0.1px',
            display: 'flex',
          }}>
            Trust-Based Social Commerce
          </div>

          {/* Three feature pillars */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { icon: '🛍', label: 'Buy & Sell' },
              { icon: '🤝', label: 'Collaborate' },
              { icon: '💎', label: 'Earn Trust' },
            ].map(({ icon, label }) => (
              <div key={label} style={{
                padding: '14px 28px',
                background: 'rgba(0,180,216,0.10)',
                border: '1.5px solid rgba(0,180,216,0.35)',
                borderRadius: 999,
                fontSize: 22,
                color: '#e2e8f0',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontSize: 24 }}>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Domain footer */}
        <div style={{
          position: 'absolute', bottom: 28, left: 0, right: 0,
          display: 'flex',
          justifyContent: 'center',
          fontSize: 18,
          color: '#475569',
          letterSpacing: '0.5px',
          zIndex: 1,
        }}>
          freetrust.co
        </div>

        {/* Bottom accent bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 6,
          background: 'linear-gradient(90deg, #00b4d8 0%, #0096c7 50%, #00b4d8 100%)',
          display: 'flex',
        }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // Cache aggressively at the edge — image is deterministic
        'Cache-Control': 'public, immutable, max-age=31536000',
      },
    }
  )
}
