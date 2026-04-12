import { ImageResponse } from 'next/og'

// Shared icon generator used by all the sized icon routes.
// Brand: dark navy #0a1628 background, sky blue #00b4d8 ₮ mark.
export function buildIcon(size: number) {
  // Radius scales with size so icons look good at every resolution.
  // Large icons (192+) look like proper app icons; tiny favicons (16) get
  // simpler geometry because detail disappears anyway.
  const isTiny = size < 48
  const radius = isTiny ? Math.round(size * 0.12) : Math.round(size * 0.22)
  const tokenSize = Math.round(size * 0.56)

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: '#0a1628',
          borderRadius: radius,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle glow — only on larger icons */}
        {!isTiny && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'radial-gradient(circle at 50% 50%, rgba(0,180,216,0.18) 0%, transparent 60%)',
              display: 'flex',
            }}
          />
        )}

        {/* ₮ token mark */}
        <div
          style={{
            fontSize: tokenSize,
            fontWeight: 900,
            color: '#00b4d8',
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1,
          }}
        >
          ₮
        </div>
      </div>
    ),
    { width: size, height: size }
  )
}
