/**
 * In-memory rate limiter (edge-compatible, no external dependencies)
 * - Login: max 5 attempts per 15 minutes per IP+email combo → lockout
 * - API:   max 100 requests per minute per user/IP
 */

interface RateLimitEntry {
  count: number
  resetAt: number
  lockedUntil?: number
}

// Global store (survives across requests in the same process)
const store = new Map<string, RateLimitEntry>()

// Sweep expired entries every 5 minutes to prevent memory leak
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((entry, key) => {
      const expiry = entry.lockedUntil ?? entry.resetAt
      if (now > expiry + 60_000) store.delete(key)
    })
  }, 5 * 60 * 1000)
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  lockedUntil?: number
}

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number; lockoutMs?: number }
): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  // If locked out
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      lockedUntil: entry.lockedUntil,
    }
  }

  // If window expired, reset
  if (!entry || now > entry.resetAt) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetAt: now + options.windowMs,
    }
    store.set(key, newEntry)
    return { allowed: true, remaining: options.limit - 1, resetAt: newEntry.resetAt }
  }

  // Within window
  entry.count++

  if (entry.count > options.limit) {
    // Apply lockout if configured
    if (options.lockoutMs) {
      entry.lockedUntil = now + options.lockoutMs
    }
    store.set(key, entry)
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      lockedUntil: entry.lockedUntil,
    }
  }

  store.set(key, entry)
  return {
    allowed: true,
    remaining: options.limit - entry.count,
    resetAt: entry.resetAt,
  }
}

/** Login rate limit: 5 attempts per 15 min, then 15 min lockout */
export function checkLoginRateLimit(ip: string, email: string): RateLimitResult {
  const key = `login:${ip}:${email.toLowerCase()}`
  return checkRateLimit(key, {
    limit: 5,
    windowMs: 15 * 60 * 1000,   // 15 minute window
    lockoutMs: 15 * 60 * 1000,  // 15 minute lockout
  })
}

/** API rate limit: 100 requests per minute per user or IP */
export function checkApiRateLimit(identifier: string): RateLimitResult {
  const key = `api:${identifier}`
  return checkRateLimit(key, {
    limit: 100,
    windowMs: 60 * 1000, // 1 minute window
  })
}

/** Reset login attempts on successful login */
export function resetLoginRateLimit(ip: string, email: string): void {
  const key = `login:${ip}:${email.toLowerCase()}`
  store.delete(key)
}

/** Signup rate limit: 5 accounts per hour per IP */
export function checkSignupRateLimit(ip: string): RateLimitResult {
  const key = `signup:${ip}`
  return checkRateLimit(key, {
    limit: 5,
    windowMs: 60 * 60 * 1000, // 1 hour
    lockoutMs: 60 * 60 * 1000, // 1 hour lockout
  })
}
