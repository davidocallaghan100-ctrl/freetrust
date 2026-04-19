import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

// GET /api/og — dynamic branded OpenGraph image (1200×630)
// Params:
//   title    — page title (default: site tagline)
//   category — category badge text (default: "Community Economy")
//
// Used by generateMetadata functions across the site so every page,
// listing, job, event, and article gets a unique branded social image
// without storing any binary assets in the repo.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') ?? 'FreeTrust — The Community Economy Marketplace'
  const category = searchParams.get('category') ?? 'Community Economy'

  // Truncate very long titles to avoid overflow
  const displayTitle = title.length > 80 ? title.slice(0, 77) + '…' : title
  const fontSize = displayTitle.length > 50 ? 52 : 64

  return new ImageResponse(
    (
      <div
        style={{
          background: '#0f172a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          padding: '72px 80px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle background glow */}
        <div style={{
          position: 'absolute',
          top: -200,
          right: -200,
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, transparent 70%)',
          display: 'flex',
        }} />
        <div style={{
          position: 'absolute',
          bottom: -150,
          left: -100,
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(56,189,248,0.08) 0%, transparent 70%)',
          display: 'flex',
        }} />

        {/* Top bar — logo + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', zIndex: 1 }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #38bdf8, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 30px rgba(56,189,248,0.4)',
          }}>
            <span style={{ color: '#0f172a', fontSize: '26px', fontWeight: '900', lineHeight: 1 }}>₮</span>
          </div>
          <span style={{ color: '#38bdf8', fontSize: '30px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            FreeTrust
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px', zIndex: 1 }}>
          {/* Category badge */}
          <div style={{
            background: 'rgba(56,189,248,0.12)',
            border: '1px solid rgba(56,189,248,0.35)',
            borderRadius: '8px',
            padding: '8px 18px',
            width: 'fit-content',
            display: 'flex',
          }}>
            <span style={{ color: '#38bdf8', fontSize: '18px', fontWeight: '600' }}>{category}</span>
          </div>

          {/* Title */}
          <div style={{
            color: '#f1f5f9',
            fontSize: `${fontSize}px`,
            fontWeight: '800',
            lineHeight: 1.1,
            letterSpacing: '-1px',
            display: 'flex',
          }}>
            {displayTitle}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          zIndex: 1,
        }}>
          <span style={{ color: '#64748b', fontSize: '20px' }}>freetrust.co</span>
          <span style={{ color: '#38bdf8', fontSize: '18px', fontWeight: '500' }}>
            The Community Economy Marketplace
          </span>
        </div>

        {/* Bottom accent bar */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '5px',
          background: 'linear-gradient(90deg, #38bdf8 0%, #0284c7 50%, #38bdf8 100%)',
          display: 'flex',
        }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    }
  )
}
