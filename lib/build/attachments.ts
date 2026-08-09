// Build — AI architecture design studio: reference image attachments.
//
// Mirrors lib/messageAttachments.ts's client-direct-upload pattern (upload
// straight from the browser to Supabase Storage using the user's own
// session, so RLS enforces ownership — no server route needed for the
// upload itself). The bucket is private; storage PATHS are what's stored
// on the message row, and the UI resolves them to short-lived signed URLs
// for display (see BuildImageThumb / BuildChat).

import type { SupabaseClient } from '@supabase/supabase-js'

export const BUILD_ATTACHMENTS_BUCKET = 'build-attachments'
export const MAX_BUILD_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB, matches lib/messageAttachments.ts
export const MAX_BUILD_IMAGES_PER_MESSAGE = 4

export const ALLOWED_BUILD_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

export function validateBuildImageFiles(files: File[], existingCount = 0): string | null {
  if (existingCount + files.length > MAX_BUILD_IMAGES_PER_MESSAGE) {
    return `You can attach up to ${MAX_BUILD_IMAGES_PER_MESSAGE} reference photos per message.`
  }
  for (const file of files) {
    if (file.size > MAX_BUILD_IMAGE_BYTES) {
      return `${file.name} is too large. The limit is 10 MB per photo.`
    }
    // Mobile camera uploads sometimes arrive with an empty file.type (older
    // iOS Safari, some Android builds) — sniff the extension defensively
    // rather than rejecting a real photo outright.
    if (file.type && !ALLOWED_BUILD_IMAGE_TYPES.has(file.type)) {
      return `${file.name} is not a supported image type. Use JPG, PNG, WEBP, or HEIC.`
    }
    if (!file.type) {
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()
      if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext)) {
        return `${file.name} has an unrecognised file type.`
      }
    }
  }
  return null
}

function safeFileName(name: string): string {
  const cleaned = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96)
  return cleaned || 'reference'
}

/**
 * Uploads reference images directly to the private build-attachments
 * bucket via the browser's own Supabase client (RLS-scoped to
 * `<user_id>/...`). Returns the storage PATHS to store in
 * build_messages.image_urls — not public URLs, since the bucket is
 * private.
 */
export async function uploadBuildImages(
  supabase: SupabaseClient,
  files: File[],
  options: { userId: string },
): Promise<string[]> {
  const validationError = validateBuildImageFiles(files)
  if (validationError) throw new Error(validationError)

  const paths: string[] = []
  for (const file of files) {
    const path = `${options.userId}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`
    const { error } = await supabase.storage
      .from(BUILD_ATTACHMENTS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || 'image/jpeg',
        upsert: false,
      })
    if (error) {
      throw new Error(`Could not upload ${file.name}: ${error.message}`)
    }
    paths.push(path)
  }
  return paths
}

export function normalizeBuildImageUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((x): x is string => typeof x === 'string' && x.length > 0)
}
