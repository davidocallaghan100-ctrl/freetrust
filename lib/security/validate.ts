/**
 * Zod schemas for common request body validation
 * Import these in API routes to validate + type-check bodies.
 */
import { z } from 'zod'

// ─── Password policy ───────────────────────────────────────────────────────
export const PASSWORD_SCHEMA = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

// ─── Auth ──────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: z.string().min(1, 'Password is required').max(128),
})

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address').max(254),
  password: PASSWORD_SCHEMA,
  full_name: z.string().min(1).max(100).trim(),
})

// ─── Profile ───────────────────────────────────────────────────────────────
export const ProfileUpdateSchema = z.object({
  full_name: z.string().min(1).max(100).trim().optional(),
  bio: z.string().max(500).trim().optional(),
  location: z.string().max(100).trim().optional(),
  avatar_url: z.string().url().max(500).optional().or(z.literal('')),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores').optional(),
})

// ─── Feed post ─────────────────────────────────────────────────────────────
export const FeedPostSchema = z.object({
  content: z.string().min(1).max(5000).trim(),
  media_url: z.string().url().max(500).optional().or(z.literal('')).optional(),
  media_type: z.enum(['image', 'video', 'audio']).optional(),
  link_url: z.string().url().max(500).optional().or(z.literal('')).optional(),
  title: z.string().max(200).trim().optional(),
  type: z.enum(['post', 'article', 'listing', 'review', 'trust_action']).default('post'),
})

// ─── Comment ───────────────────────────────────────────────────────────────
export const CommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
})

// ─── Review ────────────────────────────────────────────────────────────────
export const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().min(1).max(200).trim().optional(),
  content: z.string().min(1).max(2000).trim(),
})

// ─── Listing ───────────────────────────────────────────────────────────────
export const ListingSchema = z.object({
  title: z.string().min(1).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  price: z.number().min(0).max(1_000_000),
  currency: z.enum(['EUR', 'USD', 'GBP', 'TRUST']).default('EUR'),
  product_type: z.enum(['physical', 'digital', 'service']),
  tags: z.array(z.string().max(50)).max(10).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']).optional(),
  stock_qty: z.number().int().min(0).optional(),
})

// ─── File upload ───────────────────────────────────────────────────────────
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'] as const
export const ALLOWED_DOC_TYPES = ['application/pdf'] as const
export const ALL_ALLOWED_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_VIDEO_TYPES,
  ...ALLOWED_DOC_TYPES,
] as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File too large (max 10MB)' }
  }
  if (!(ALL_ALLOWED_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, error: 'File type not allowed. Allowed: jpg, png, gif, mp4, pdf' }
  }
  return { valid: true }
}

// ─── URL validation ────────────────────────────────────────────────────────
export const UrlSchema = z.string().url().max(500).refine(
  (url) => {
    try {
      const u = new URL(url)
      return ['http:', 'https:'].includes(u.protocol)
    } catch {
      return false
    }
  },
  { message: 'Only http/https URLs are allowed' }
)

// ─── Community post ────────────────────────────────────────────────────────
export const CommunityPostSchema = z.object({
  title: z.string().min(1).max(300).trim(),
  content: z.string().min(1).max(10000).trim(),
  type: z.enum(['discussion', 'question', 'announcement', 'resource']).default('discussion'),
  link_url: z.string().url().max(500).optional().or(z.literal('')).optional(),
})

// ─── Org / Business ────────────────────────────────────────────────────────
export const OrgUpdateSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(2000).trim().optional(),
  tagline: z.string().max(200).trim().optional(),
  website: z.string().url().max(500).optional().or(z.literal('')).optional(),
  location: z.string().max(100).trim().optional(),
  sector: z.string().max(100).trim().optional(),
  tags: z.array(z.string().max(50)).max(15).optional(),
})

// ─── Helper: parse and return 400 on validation failure ───────────────────
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data: T; error: null } | { data: null; error: string } {
  const result = schema.safeParse(body)
  if (!result.success) {
    const issues = result.error.issues ?? []
    const msg = issues.map((e: { message: string }) => e.message).join('; ')
    return { data: null, error: msg || 'Validation failed' }
  }
  return { data: result.data, error: null }
}
