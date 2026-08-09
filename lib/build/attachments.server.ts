// Build — AI architecture design studio: SERVER-ONLY reference image
// resolution. Split out from lib/build/attachments.ts because this file
// uses the Node `Buffer` global, which must never end up in the client
// bundle. Only import this from API routes (app/api/build/**).

import type { SupabaseClient } from '@supabase/supabase-js'
import { BUILD_ATTACHMENTS_BUCKET, MAX_BUILD_IMAGES_PER_MESSAGE } from './attachments'

const EXT_TO_MEDIA_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
}

function mediaTypeFromPath(path: string): string {
  const ext = (path.split('.').pop() ?? '').toLowerCase()
  return EXT_TO_MEDIA_TYPE[ext] ?? 'image/jpeg'
}

/**
 * Downloads reference images from the private build-attachments bucket
 * (via the admin/service-role client) and base64-encodes them for the
 * Anthropic API's image content-block format.
 *
 * Ownership check: every path MUST start with `${userId}/` — the admin
 * client bypasses Storage RLS, so this guard is what actually stops one
 * user's generate request from being able to reference another user's
 * uploaded photos by guessing/tampering with a path string.
 *
 * Individual download/decode failures are skipped (not thrown) so one bad
 * path never blocks the whole generate request — Claude still gets
 * whatever images did resolve, plus the text prompt.
 */
export async function downloadBuildImagesAsBase64(
  admin: SupabaseClient,
  userId: string,
  paths: string[],
): Promise<{ media_type: string; data: string }[]> {
  const owned = paths
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .filter(p => p.startsWith(`${userId}/`))
    .slice(0, MAX_BUILD_IMAGES_PER_MESSAGE)

  const results: { media_type: string; data: string }[] = []
  for (const path of owned) {
    try {
      const { data, error } = await admin.storage.from(BUILD_ATTACHMENTS_BUCKET).download(path)
      if (error || !data) {
        console.error('[build/attachments.server] download failed for', path, error?.message)
        continue
      }
      const arrayBuffer = await data.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')
      const mediaType = (data as Blob).type || mediaTypeFromPath(path)
      results.push({ media_type: mediaType, data: base64 })
    } catch (err) {
      console.error('[build/attachments.server] unexpected error resolving', path, err)
    }
  }
  return results
}
