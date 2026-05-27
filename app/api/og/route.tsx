import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const LOGO_URL = 'https://freetrust.co/icons/icon-512x512.png'

// GET /api/og — dynamic branded OpenGraph image (1200×630)
// Params:
//   title    — page title (default: site tagline)
//   category — category badge text (default: "Community Economy")
//   image    — optional HTTPS image URL to feature; falls back to FreeTrust logo
//
// Used by generateMetadata functions across the site so every page,
// listing, job, event, and article gets a unique branded social image
// without storing any binary assets in the repo.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title = searchParams.get('title') ?? 'FreeTrust — The Community Economy Marketplace'
  const category = searchParams.get('category') ?? 'Community Economy'
  const imageParam = searchParams.get('image')
  const featureImage = imageParam && /^https:\/\//i.test(imageParam) ? imageParam : LOGO_URL
  const hasPostImage = featureImage !== LOGO_URL

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
          <img
            src={LOGO_URL}
            alt="FreeTrust"
            width={52}
            height={52}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '12px',
              objectFit: 'cover',
              boxShadow: '0 0 30px rgba(56,189,248,0.34)',
            }}
          />
          <span style={{ color: '#38bdf8', fontSize: '30px', fontWeight: '800', letterSpacing: '-0.5px' }}>
            FreeTrust
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '42px', width: '100%', zIndex: 1 }}>
          <div style={{
            width: hasPostImage ? 475 : 260,
            height: hasPostImage ? 320 : 260,
            borderRadius: hasPostImage ? 32 : 58,
            overflow: 'hidden',
            border: '2px solid rgba(56,189,248,0.35)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.38), 0 0 48px rgba(56,189,248,0.18)',
            background: '#020617',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <img
              src={featureImage}
              alt=""
              width={hasPostImage ? 475 : 260}
              height={hasPostImage ? 320 : 260}
              style={{ width: '100%', height: '100%', objectFit: hasPostImage ? 'cover' : 'contain' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0, flex: 1 }}>
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
              fontSize: `${hasPostImage ? Math.min(fontSize, 48) : fontSize}px`,
              fontWeight: '800',
              lineHeight: 1.1,
              letterSpacing: '-1px',
              display: 'flex',
            }}>
              {displayTitle}
            </div>
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
