'use client'

import type { CSSProperties } from 'react'

// Three pulsing dots — a CSS-only "thinking"/"working" indicator shared by
// Build's chat "thinking" placeholder, on-demand section generation, and
// PDF download. No new dependency: follows the same plain <style> tag +
// @keyframes convention already used elsewhere in the app (see
// CheckoutSuccessContent.tsx, ProfilePage.tsx spin animations) rather than
// styled-jsx or an icon library.
export default function BuildLoadingDots({ color = '#8ca7b5', size = 5 }: { color?: string; size?: number }) {
  const dotStyle = (delaySeconds: number): CSSProperties => ({
    width: size,
    height: size,
    borderRadius: '50%',
    background: color,
    display: 'inline-block',
    animation: `build-dot-pulse 1.1s ease-in-out ${delaySeconds}s infinite`,
  })
  return (
    <span style={{ display: 'inline-flex', gap: Math.max(3, size * 0.7), alignItems: 'center' }}>
      <style>{`@keyframes build-dot-pulse { 0%, 80%, 100% { opacity: 0.25; transform: scale(0.7); } 40% { opacity: 1; transform: scale(1); } }`}</style>
      <span style={dotStyle(0)} />
      <span style={dotStyle(0.15)} />
      <span style={dotStyle(0.3)} />
    </span>
  )
}
