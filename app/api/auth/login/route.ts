/**
 * POST /api/auth/login
 * Server-side login with rate limiting + lockout
 * The middleware already checks rate limits before this runs.
 * This route resets the counter on success.
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
    const supabase = await createClient()
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

    // Success — reset rate limit counter
    resetLoginRateLimit(ip, email)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
