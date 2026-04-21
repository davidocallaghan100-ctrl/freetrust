/**
 * POST /api/auth/login
 * Server-side login with rate limiting + lockout.
 * Uses request/response-based createServerClient so Supabase session cookies
 * are correctly forwarded to the browser in the HTTP response.
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { checkLoginRateLimit, resetLoginRateLimit } from '@/lib/security/rate-limit'
import { LoginSchema, parseBody } from '@/lib/security/validate'
import { sanitizeString } from '@/lib/security/sanitize'

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  const ip = getIp(req)

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { data: parsedData, error: validationError } = parseBody(LoginSchema, rawBody)
  if (validationError || !parsedData) {
    return NextResponse.json({ error: validationError ?? 'Invalid request' }, { status: 400 })
  }

  const email = sanitizeString(parsedData.email).toLowerCase()

  // Check rate limit (middleware already checked IP-level, this checks IP+email combo)
  const rateLimit = checkLoginRateLimit(ip, email)
  if (!rateLimit.allowed) {
    const waitMins = rateLimit.lockedUntil
      ? Math.ceil((rateLimit.lockedUntil - Date.now()) / 60000)
      : 15
    return NextResponse.json(
      { error: `Too many login attempts. Please wait ${waitMins} minute${waitMins !== 1 ? 's' : ''} before trying again.` },
      { status: 429, headers: { 'Retry-After': String(waitMins * 60) } }
    )
  }

  try {
    // Use the request/response pattern so Supabase session cookies are correctly
    // added to the outgoing response (not an implicit context that NextResponse.json()
    // wouldn't inherit).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // We'll build the success response after auth so we can attach cookies to it.
    let response = NextResponse.json({ success: true })

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Apply cookies to the request (for any subsequent reads in this handler)
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          // Build a fresh response so we can attach the Set-Cookie headers
          response = NextResponse.json({ success: true })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: parsedData.password,
    })

    if (authError) {
      // Generic message — never reveal whether email exists
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Success — reset rate limit counter and return response with session cookies
    resetLoginRateLimit(ip, email)
    return response
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
