const CACHE_VERSION = 1
const INBOX_TTL_MS = 5 * 60 * 1000
const THREAD_TTL_MS = 15 * 60 * 1000
const MAX_INBOX_BYTES = 250_000
const MAX_THREAD_BYTES = 1_500_000

interface CacheEnvelope<T> {
  version: number
  savedAt: number
  data: T
}

const memoryCache = new Map<string, CacheEnvelope<unknown>>()

function readCache<T>(key: string, ttlMs: number): T | null {
  const inMemory = memoryCache.get(key)
  const raw = inMemory ?? (() => {
    if (typeof window === 'undefined') return null
    try {
      const stored = window.sessionStorage.getItem(key)
      return stored ? JSON.parse(stored) as CacheEnvelope<unknown> : null
    } catch {
      return null
    }
  })()

  if (!raw || raw.version !== CACHE_VERSION || Date.now() - raw.savedAt > ttlMs) return null
  memoryCache.set(key, raw)
  return raw.data as T
}

function writeCache<T>(key: string, data: T, maxBytes: number): void {
  const envelope: CacheEnvelope<T> = { version: CACHE_VERSION, savedAt: Date.now(), data }
  memoryCache.set(key, envelope)
  if (typeof window === 'undefined') return

  try {
    const serialized = JSON.stringify(envelope)
    if (serialized.length > maxBytes) return
    window.sessionStorage.setItem(key, serialized)
  } catch {
    // A full/disabled sessionStorage must never slow or break messaging.
  }
}

function inboxKey(userId: string): string {
  return `freetrust:messages:inbox:v${CACHE_VERSION}:${userId}`
}

function threadKey(userId: string, conversationId: string): string {
  return `freetrust:messages:thread:v${CACHE_VERSION}:${userId}:${conversationId}`
}

export function readInboxCache<T>(userId: string): T | null {
  return readCache<T>(inboxKey(userId), INBOX_TTL_MS)
}

export function writeInboxCache<T>(userId: string, data: T): void {
  writeCache(inboxKey(userId), data, MAX_INBOX_BYTES)
}

export function readThreadCache<T>(userId: string, conversationId: string): T | null {
  return readCache<T>(threadKey(userId, conversationId), THREAD_TTL_MS)
}

export function writeThreadCache<T>(userId: string, conversationId: string, data: T): void {
  writeCache(threadKey(userId, conversationId), data, MAX_THREAD_BYTES)
}
