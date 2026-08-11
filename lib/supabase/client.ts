import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

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
