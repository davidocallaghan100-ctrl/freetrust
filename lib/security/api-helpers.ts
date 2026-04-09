/**
 * API security helpers
 * - getClientIp: extract real IP from request
 * - withRateLimit: wrapper applying API rate limit
 * - requireAuth: extract and verify authenticated user
 * - genericError: always returns a safe generic error response
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkApiRateLimit } from './rate-limit'

/** Extract the best available client IP */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

/** Apply API rate limit (100 req/min). Returns 429 response if exceeded, null if OK. */
export function applyApiRateLimit(req: NextRequest, userId?: string): NextResponse | null {
  const ip = getClientIp(req)
  const identifier = userId ?? ip
  const result = checkApiRateLimit(identifier)

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
        },
      }
    )
  }
  return null
}

/** Get authenticated user or return null */
export async function getAuthUser(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return user
  } catch {
    return null
  }
}

/** Require authenticated user — returns 401 if not authed */
export async function requireAuth(req: NextRequest): Promise<
  { user: Awaited<ReturnType<typeof getAuthUser>>; error: null } |
  { user: null; error: NextResponse }
> {
  const user = await getAuthUser(req)
  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    }
  }
  return { user, error: null }
}

/** Always log the real error server-side, return generic message to client */
export function serverError(context: string, err: unknown): NextResponse {
  console.error(`[${context}]`, err instanceof Error ? err.message : err)
  return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
}

/** Validate Content-Type is application/json for mutation requests */
export function requireJsonBody(req: NextRequest): NextResponse | null {
  const ct = req.headers.get('content-type') ?? ''
  if (!ct.includes('application/json')) {
    return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
  }
  return null
}
