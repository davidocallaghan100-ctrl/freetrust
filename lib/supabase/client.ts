import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export interface StoredSessionCredentials {
  accessToken: string
  userId: string
  expiresAt: number | null
}

function decodeBase64Url(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function decodeJwtPayload(token: string): { sub?: string; exp?: number } | null {
  const encodedPayload = token.split('.')[1]
  if (!encodedPayload) return null
  const decoded = decodeBase64Url(encodedPayload)
  if (!decoded) return null
  try {
    const payload = JSON.parse(decoded) as { sub?: unknown; exp?: unknown }
    return {
      sub: typeof payload.sub === 'string' ? payload.sub : undefined,
      exp: typeof payload.exp === 'number' ? payload.exp : undefined,
    }
  } catch {
    return null
  }
}

/**
 * Read the current Supabase SSR session cookie without entering GoTrue's
 * async session/refresh path. This is deliberately only used as a fast
 * credential read: Supabase Storage still validates the JWT signature and
 * expiry when the token is sent with the upload request.
 *
 * On iOS Safari/WKWebView, `auth.getSession()` can remain pending even when
 * the auth cookie is already present. Uploads need the bearer token, not a
 * second server-side user lookup, so decoding the cookie avoids turning a
 * valid signed-in session into an upload timeout.
 */
export function getStoredSessionCredentials(): StoredSessionCredentials | null {
  if (typeof document === 'undefined') return null

  try {
    const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
    const cookieName = `sb-${projectRef}-auth-token`
    const cookies = new Map<string, string>()

    for (const rawCookie of document.cookie.split(';')) {
      const separator = rawCookie.indexOf('=')
      if (separator <= 0) continue
      const rawName = rawCookie.slice(0, separator).trim()
      const rawValue = rawCookie.slice(separator + 1).trim()
      try {
        cookies.set(decodeURIComponent(rawName), decodeURIComponent(rawValue))
      } catch {
        cookies.set(rawName, rawValue)
      }
    }

    let encodedSession = cookies.get(cookieName) ?? ''
    if (!encodedSession) {
      const chunks: string[] = []
      for (let index = 0; ; index += 1) {
        const chunk = cookies.get(`${cookieName}.${index}`)
        if (!chunk) break
        chunks.push(chunk)
      }
      encodedSession = chunks.join('')
    }
    if (!encodedSession) return null

    let sessionJson = encodedSession
    if (sessionJson.startsWith('base64-')) {
      sessionJson = decodeBase64Url(sessionJson.slice('base64-'.length)) ?? ''
    }
    if (!sessionJson) return null

    const parsed = JSON.parse(sessionJson) as {
      access_token?: unknown
      expires_at?: unknown
      user?: { id?: unknown }
    }
    const accessToken = typeof parsed.access_token === 'string' ? parsed.access_token : ''
    if (!accessToken) return null

    const tokenPayload = decodeJwtPayload(accessToken)
    const userId = typeof parsed.user?.id === 'string' ? parsed.user.id : tokenPayload?.sub
    if (!userId) return null

    const expiresAt = typeof parsed.expires_at === 'number'
      ? parsed.expires_at
      : typeof tokenPayload?.exp === 'number' ? tokenPayload.exp : null

    return { accessToken, userId, expiresAt }
  } catch {
    return null
  }
}

// Module-level singleton. Every page/component on FreeTrust calls
// createClient() independently (80+ call sites) — before this fix each
// call created a brand-new GoTrueClient bound to the same
// `sb-<ref>-auth-token` storage key. Multiple concurrent GoTrueClient
// instances race on Supabase's cross-tab session lock (navigator.locks /
// the auth-token storage mutex), and on pages that mount many
// Supabase-calling components at once (e.g. /messages, which pulls in
// MessageDrawer, GifPicker, and the conversation list simultaneously)
// this could cause individual `supabase.auth.getUser()` calls to fail
// silently, which — combined with no error handling at the call sites —
// made the inbox render as permanently empty ("No conversations yet")
// even though real conversations/messages existed. Returning the same
// client instance on every call avoids the lock contention entirely and
// is the pattern Supabase's own docs recommend for the browser client.
let browserClient: SupabaseClient | undefined

// GoTrueClient (the auth module inside supabase-js) serializes session
// read/refresh work through `navigator.locks.request(...)` when the Web
// Locks API is available, so concurrent calls to auth.getSession() /
// getUser() across tabs or instances don't stomp on each other. In
// practice this lock has been observed to never resolve on some real
// devices/browsers (notably iOS Safari/WKWebView, and some automated/
// headless Chromium contexts) — once that happens every future
// getSession()/getUser() call on the page hangs forever with no error,
// which is exactly the symptom reported for /dashboard/analytics
// ("Loading analytics…" spinning indefinitely: supabase.auth.getSession()
// never resolved, so the page never reached its Supabase queries at all —
// confirmed by zero analytics_events/profiles network requests ever
// firing, while the same REST queries succeeded instantly when called
// directly). Since createClient() now returns a single shared instance
// (see above), there is no real cross-instance contention left to
// protect against, so it's safe to bypass the Locks API entirely with a
// no-op lock that just runs the callback immediately. This is Supabase's
// own documented workaround for these lock hangs.
const noopLock = async <R>(_name: string, _acquireTimeout: number, fn: () => Promise<R>): Promise<R> => fn()

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { lock: noopLock },
    })
  }
  return browserClient
}
