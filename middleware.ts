import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { checkApiRateLimit, checkLoginRateLimit, checkSignupRateLimit } from '@/lib/security/rate-limit'

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/** Attach security headers to every response */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // geolocation=(self) — allow same-origin access so the marketplace
  // "Near Me" filter and the events map can detect the user's coordinates
  // via navigator.geolocation. Camera + microphone stay blocked.
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)')
  response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  // Content Security Policy
  //
  // Added for the globalisation feature:
  //   * script-src  + https://unpkg.com — Leaflet library (events map)
  //   * style-src   + https://unpkg.com — Leaflet base stylesheet
  //   * img-src     already covers https: (OpenStreetMap tile PNGs)
  //   * connect-src + https://nominatim.openstreetmap.org — location search
  //                + https://api.frankfurter.app               — live FX rates
  //                + https://ipapi.co                          — free IP geoloc
  //                + https://tile.openstreetmap.org            — map tiles
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "media-src 'self' https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://www.google-analytics.com https://nominatim.openstreetmap.org https://api.frankfurter.app https://ipapi.co https://tile.openstreetmap.org",
      "frame-src https://js.stripe.com https://hooks.stripe.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ')
  )
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const ip = getClientIp(request)

  // ── 1. API rate limiting ────────────────────────────────────────────────
  if (pathname.startsWith('/api/')) {
    // Special: login endpoint uses stricter login rate limit
    if (pathname === '/api/auth/login' && request.method === 'POST') {
      let email = ''
      try {
        const body = await request.clone().json() as { email?: string }
        email = body.email ?? ''
      } catch { /* ignore parse errors */ }
      const loginResult = checkLoginRateLimit(ip, email)
      if (!loginResult.allowed) {
        const waitSecs = loginResult.lockedUntil
          ? Math.ceil((loginResult.lockedUntil - Date.now()) / 1000)
          : 900
        const res = NextResponse.json(
          { error: `Too many login attempts. Please wait ${Math.ceil(waitSecs / 60)} minutes before trying again.` },
          { status: 429 }
        )
        res.headers.set('Retry-After', String(waitSecs))
        return applySecurityHeaders(res)
      }
    }

    // Signup endpoint: 5 per hour per IP (anti-bot)
    if (pathname === '/api/auth/signup-bonus' && request.method === 'POST') {
      const signupResult = checkSignupRateLimit(ip)
      if (!signupResult.allowed) {
        const waitSecs = signupResult.lockedUntil
          ? Math.ceil((signupResult.lockedUntil - Date.now()) / 1000)
          : 3600
        const res = NextResponse.json(
          { error: 'Too many signup attempts. Please try again later.' },
          { status: 429 }
        )
        res.headers.set('Retry-After', String(waitSecs))
        return applySecurityHeaders(res)
      }
    }

    // General API rate limit: 100 req/min per IP
    const apiResult = checkApiRateLimit(ip)
    if (!apiResult.allowed) {
      const res = NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((apiResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
          },
        }
      )
      return applySecurityHeaders(res)
    }
  }

  // ── 2. Supabase auth session refresh ────────────────────────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === 'https://placeholder.supabase.co') {
    return applySecurityHeaders(NextResponse.next({ request }))
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Auth check failed — allow through, page-level will handle
  }

  // ── 3. Protected route redirect ─────────────────────────────────────────
  const protectedPaths = [
    // Account & commerce
    '/dashboard',
    '/wallet',
    '/admin',
    '/profile',
    '/settings',
    '/analytics',
    '/messages',
    '/notifications',
    '/orders',
    '/onboarding',
    // Connections & community
    '/connections',
    '/collab',
    // Create / submit actions — all require auth
    '/checkout',            // service/product checkout
    '/create',              // general post/listing creation
    '/feed/new',            // new feed post
    '/articles/new',        // new article
    '/articles/drafts',
    '/organisations/new',   // create organisation
    '/events/create',       // create event
    '/grassroots/new',      // create grassroots listing
    '/community/new',       // create community
    '/seller',              // all seller pages (gigs, listings, etc.)
    '/jobs/new',
    '/create-business',
  ]
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    const redirectRes = NextResponse.redirect(url)
    return applySecurityHeaders(redirectRes)
  }

  return applySecurityHeaders(supabaseResponse)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
