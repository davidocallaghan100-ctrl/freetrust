'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/context/ThemeContext'

type ThemeToggleButtonProps = {
  variant?: 'header' | 'floating'
}

// Same viewport-detection approach as LanguageSelector — read window width
// only after mount so SSR/first-paint markup is identical for every client
// (avoids hydration mismatches from deciding header-vs-floating based on
// window.innerWidth during the initial render).
function useViewportWidth() {
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return width
}

// A small, always-visible light/dark toggle that mirrors the visual
// language and responsive behavior of LanguageSelector so the two controls
// read as a pair wherever they're placed together — currently the landing
// page header (desktop) and as a floating button (mobile). The full toggle
// with label also still lives in the Nav drawer's Account section; this is
// a quicker, more discoverable shortcut next to the language switcher.
export default function ThemeToggleButton({ variant = 'header' }: ThemeToggleButtonProps) {
  const { theme, toggleTheme } = useTheme()
  const width = useViewportWidth()
  const viewportResolved = width !== null
  const isMobile = viewportResolved && width < 768
  const floating = variant === 'floating'
  const isDark = theme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  // Mirror LanguageSelector's render rules exactly: the floating variant is
  // mobile-only, the header variant is desktop-only. This keeps the two
  // controls from ever appearing twice (or not at all) at any viewport.
  if (floating && (!viewportResolved || !isMobile)) return null
  if (!floating && isMobile) return null

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      style={floating ? {
        position: 'fixed',
        top: '160px',
        right: 0,
        zIndex: 101,
        minWidth: 48,
        width: 48,
        height: 42,
        borderRadius: '12px 0 0 12px',
        border: '1px solid rgba(56,189,248,0.28)',
        background: 'rgba(15,23,42,0.88)',
        color: '#e0f2fe',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 20,
        boxShadow: '0 12px 30px rgba(2,6,23,0.48), 0 0 18px rgba(56,189,248,0.16)',
        backdropFilter: 'blur(12px)',
      } : {
        position: 'relative',
        flexShrink: 0,
        minWidth: 34,
        width: 34,
        height: 34,
        borderRadius: 999,
        border: '1px solid rgba(56,189,248,0.28)',
        background: 'rgba(15,23,42,0.72)',
        color: '#e0f2fe',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 15,
        boxShadow: 'none',
        backdropFilter: 'blur(12px)',
      }}
    >
      <span aria-hidden="true">{isDark ? '🌙' : '☀️'}</span>
    </button>
  )
}
