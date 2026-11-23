import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const LISTINGS_READ_SCOPE = 'listings:read'
export const API_KEY_PREFIX = 'ft_live_'

const API_KEY_RE = /^ft_live_[A-Za-z0-9_-]{43}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ListingType = 'product' | 'service'
export type KeyMaterial = { token: string; prefix: string; secretHash: string }
export type ListingPageParams = { type: ListingType; page: number; perPage: number; category: string | null }

export function createApiKeyMaterial(): KeyMaterial {
  const token = `${API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`
  return { token, prefix: token.slice(0, 20), secretHash: hashApiKey(token) }
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidApiKeyToken(token: string): boolean {
  return API_KEY_RE.test(token)
}

export function verifyApiKeyToken(token: string, storedHash: string): boolean {
  if (!isValidApiKeyToken(token) || !/^[a-f0-9]{64}$/i.test(storedHash)) return false
  const expected = Buffer.from(storedHash, 'hex')
  const actual = Buffer.from(hashApiKey(token), 'hex')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function parseDeveloperBearer(header: string | null): { token: string; prefix: string } | null {
  if (!header || header.length > 128) return null
  const match = /^Bearer\s+(ft_live_[A-Za-z0-9_-]{43})$/i.exec(header.trim())
  if (!match || !isValidApiKeyToken(match[1])) return null
  const token = match[1]
  return { token, prefix: token.slice(0, 20) }
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function parseListingPageParams(url: URL):
  | { ok: true; value: ListingPageParams }
  | { ok: false; message: string } {
  const type = url.searchParams.get('type')
  if (type !== 'product' && type !== 'service') {
    return { ok: false, message: 'The type parameter must be product or service.' }
  }

  const page = parsePositiveInteger(url.searchParams.get('page'), 1)
  const perPage = parsePositiveInteger(url.searchParams.get('per_page'), 20)
  if (page === null || page > 1000) return { ok: false, message: 'Page must be an integer from 1 to 1000.' }
  if (perPage === null || perPage > 50) return { ok: false, message: 'per_page must be an integer from 1 to 50.' }

  const category = url.searchParams.get('category')?.trim() || null
  if (category && category.length > 80) return { ok: false, message: 'Category must be 80 characters or fewer.' }
  return { ok: true, value: { type, page, perPage, category } }
}

function parsePositiveInteger(value: string | null, defaultValue: number): number | null {
  if (value === null) return defaultValue
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null
}

type PublicProfile = { full_name?: unknown; avatar_url?: unknown; deleted_at?: unknown }

function firstRelation(value: unknown): PublicProfile | null {
  if (Array.isArray(value)) return (value[0] as PublicProfile | undefined) ?? null
  if (value && typeof value === 'object') return value as PublicProfile
  return null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function finiteNumberOrNull(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/** Explicit public contract projection; never return a raw database row. */
export function toPublicListing(row: Record<string, unknown>) {
  const type = row.product_type === 'service' ? 'service' : 'product'
  const seller = firstRelation(row.seller)
  const sellerIsDeleted = Boolean(seller && stringOrNull(seller.deleted_at))
  const images = Array.isArray(row.images)
    ? row.images.filter((image): image is string => typeof image === 'string' && image.length > 0)
    : []
  const reviewCount = finiteNumberOrNull(row.review_count)
  const averageRating = finiteNumberOrNull(row.avg_rating)
  const city = stringOrNull(row.city)
  const region = stringOrNull(row.region)
  const country = stringOrNull(row.country)

  return {
    id: stringOrNull(row.id),
    type,
    title: stringOrNull(row.title),
    description: stringOrNull(row.description),
    price: {
      amount: row.price === null || row.price === undefined ? null : String(row.price),
      currency: stringOrNull(row.currency_code) ?? stringOrNull(row.currency),
    },
    imageUrl: stringOrNull(row.cover_image) ?? images[0] ?? null,
    category: stringOrNull(row.category),
    location: {
      // Do not expose the free-form location or label columns: either may hold
      // a precise address. Only use the typed coarse-grained location fields.
      label: [city, region, country].filter(Boolean).join(', ') || null,
      city,
      region,
      country,
      remote: row.is_remote === true,
    },
    service: type === 'service'
      ? {
          mode: stringOrNull(row.service_mode),
          tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === 'string') : [],
        }
      : null,
    rating: reviewCount && reviewCount > 0 && averageRating !== null
      ? { average: averageRating, count: reviewCount }
      : null,
    publishedAt: stringOrNull(row.created_at),
    seller: seller && !sellerIsDeleted ? {
      name: stringOrNull(seller.full_name),
      avatarUrl: stringOrNull(seller.avatar_url),
    } : null,
  }
}
