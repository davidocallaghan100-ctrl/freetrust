/**
 * Shared direct-to-Supabase-Storage upload helper.
 *
 * Extracted from app/create/page.tsx's local uploadToSupabaseStorageDirect
 * (same behavior/signature) so the Stories feature can reuse the exact same
 * hardened upload path — abortable fetch with a size-scaled timeout, clean
 * error messages, and a public URL built without an extra storage-js call —
 * without duplicating logic or touching the existing create-page uploader.
 */

export interface DirectStorageUploadResult {
  publicUrl: string
  storagePath: string
}

export const PHOTO_UPLOAD_TIMEOUT_MS = 45_000

const VIDEO_UPLOAD_TIMEOUT_FLOOR_MS = 60_000    // 1 min minimum (stories cap at 30s clips, so uploads are small)
const VIDEO_UPLOAD_TIMEOUT_CAP_MS = 300_000     // 5 min maximum
const VIDEO_UPLOAD_MS_PER_MB = 3_000            // ≈333 KB/s sustained-throughput budget

export function getVideoUploadTimeoutMs(fileSizeBytes: number): number {
  const sizeMb = fileSizeBytes / (1024 * 1024)
  const scaled = VIDEO_UPLOAD_TIMEOUT_FLOOR_MS + sizeMb * VIDEO_UPLOAD_MS_PER_MB
  return Math.min(VIDEO_UPLOAD_TIMEOUT_CAP_MS, Math.max(VIDEO_UPLOAD_TIMEOUT_FLOOR_MS, scaled))
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

export async function uploadToSupabaseStorageDirect(params: {
  bucket: string
  storagePath: string
  file: File | Blob
  contentType: string
  accessToken: string
  timeoutMs: number
}): Promise<DirectStorageUploadResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase upload config is missing')
  }

  const encodedPath = encodeStoragePath(params.storagePath)
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${params.bucket}/${encodedPath}`
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), params.timeoutMs)

  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${params.accessToken}`,
        'cache-control': '31536000',
        'content-type': params.contentType,
        'x-upsert': 'false',
      },
      body: params.file,
      signal: controller.signal,
    })

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`.trim()
      try {
        const data = await res.json() as { error?: string; message?: string }
        detail = data.error || data.message || detail
      } catch {
        try {
          const text = await res.text()
          if (text.trim()) detail = text.slice(0, 180)
        } catch { /* ignore */ }
      }
      throw new Error(detail)
    }

    return {
      publicUrl: `${supabaseUrl}/storage/v1/object/public/${params.bucket}/${encodedPath}`,
      storagePath: params.storagePath,
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      const seconds = Math.round(params.timeoutMs / 1000)
      throw new Error(`Upload timed out after ${seconds}s. Please try again on Wi‑Fi or choose a smaller file.`)
    }
    throw err
  } finally {
    window.clearTimeout(timeout)
  }
}

/** Extracts the "<user_id>/<filename>" storage path from a public stories URL. */
export function storiesPathFromPublicUrl(mediaUrl: string): string | null {
  const marker = '/storage/v1/object/public/stories/'
  const idx = mediaUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(mediaUrl.slice(idx + marker.length))
}
