'use client'
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ────────────────────────────────────────────────────────────────────────────
// Platform light/dark theme context
// ────────────────────────────────────────────────────────────────────────────
// Phase 1 scope (shipped): global shell/chrome (Nav, BottomNav, Sidebar,
// drawer, root layout background).
// Phase 2 scope (shipped): individual page content (feed, marketplace,
// profile, wallet, calendar, map, earn, settings-adjacent screens, etc.)
// now also reads these CSS variables. A few pages with concurrent in-flight
// work from other sessions (Messages, Settings, Build) were intentionally
// left untouched this round to avoid clobbering unrelated changes — they
// still render correctly, just always in the dark palette for now.
//
// Persistence:
//   - localStorage (`freetrust_theme`) for every visitor, logged in or not.
//   - For signed-in users, the choice is additionally synced to
//     `public.user_preferences.theme` via /api/preferences/theme so it
//     follows the user across devices/browsers. On load, the DB value (if
//     present) wins over whatever is in localStorage for that device.
//
// A tiny inline script in app/layout.tsx sets `data-theme` on <html>
// synchronously before hydration so there is no light/dark flash on load.

export type ThemeMode = 'dark' | 'light'

const STORAGE_KEY = 'freetrust_theme'
const DEFAULT_THEME: ThemeMode = 'dark'

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function applyThemeAttribute(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(DEFAULT_THEME)
  const hasSyncedFromServer = useRef(false)

  // 1. Hydrate from localStorage immediately on mount (the inline head
  // script already set the DOM attribute synchronously; this just syncs
  // React state so the toggle UI shows the correct icon/label without a
  // flash).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored)
        applyThemeAttribute(stored)
      }
    } catch { /* localStorage disabled — stay on default dark */ }
  }, [])

  // 2. If signed in, prefer the server-saved preference (cross-device sync)
  // over whatever is in localStorage on this particular device. Logged-out
  // visitors and users with no saved row keep the localStorage/default
  // value from step 1.
  useEffect(() => {
    if (hasSyncedFromServer.current) return
    hasSyncedFromServer.current = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const res = await fetch('/api/preferences/theme', { cache: 'no-store' })
        if (!res.ok) return
        const d = await res.json() as { theme?: ThemeMode | null }
        if (d.theme === 'light' || d.theme === 'dark') {
          setThemeState(d.theme)
          applyThemeAttribute(d.theme)
          try { window.localStorage.setItem(STORAGE_KEY, d.theme) } catch { /* ignore storage */ }
        }
      } catch { /* not signed in, offline, or table not migrated yet — fine, keep local value */ }
    })()
  }, [])

  const setTheme = useCallback((next: ThemeMode) => {
    setThemeState(next)
    applyThemeAttribute(next)
    try { window.localStorage.setItem(STORAGE_KEY, next) } catch { /* ignore storage */ }

    // Best-effort sync to the server for signed-in users. Fire-and-forget —
    // the localStorage write above already made the change durable on this
    // device even if the network call fails.
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        await fetch('/api/preferences/theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: next }),
        })
      } catch { /* offline or not signed in — localStorage already has it */ }
    })()
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback for any consumer rendered outside the provider (should
    // not normally happen since ThemeProvider wraps the whole app).
    return { theme: 'dark' as ThemeMode, setTheme: () => {}, toggleTheme: () => {} }
  }
  return ctx
}

// Inline script source injected into <head> so the correct theme is applied
// before React hydrates — avoids a dark→light (or light→dark) flash.
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var t = window.localStorage.getItem('${STORAGE_KEY}');
    if (t === 'light' || t === 'dark') {
      document.documentElement.setAttribute('data-theme', t);
    }
  } catch (e) {}
})();
`
