/**
 * Shared direct-to-Supabase-Storage upload helpers.
 *
 * Two transports are exported:
 *  - `uploadToSupabaseStorageDirect()` — single-request upload via
 *    XMLHttpRequest (upgraded from a plain `fetch` on 2026-08-16 so callers
 *    get real `upload.progress` events — `fetch` has no upload-progress API).
 *    Used for photos and small clips (e.g. Stories, capped at 30s).
 *  - `uploadVideoResumable()` — TUS resumable upload for larger videos
 *    (added 2026-08-16). A dropped mobile connection resumes from the last
 *    uploaded 6MB chunk instead of restarting the whole file, which is the
 *    real bottleneck for large screen-recording uploads on flaky networks —
 *    something a single-shot request can never recover from short of a full
 *    retry from byte zero.
 *
 * Both transports report progress through the same `UploadProgressSnapshot`
 * shape via `createUploadProgressTracker()` so UI code can render one
 * consistent progress bar + ETA regardless of which path was used.
 *
 * Also exports `compressImageForUpload()` (added 2026-08-24) — a canvas-based
 * resize/re-encode step for still-image uploads (photos, featured/cover
 * images). This is deliberately NOT used for video uploads; the TUS
 * resumable path above is already tuned for large video files and
 * transcoding video client-side is a different problem entirely. Motivated
 * by a real production incident where 5 AI-generated PNGs on one article
 * totalled ~8.3MB uncompressed with no client-side resize/compression step,
 * making that article's page slow to load purely from image weight — see
 * `.memory/capabilities/freetrust-article-editor.md` for the full writeup.
 */

export interface DirectStorageUploadResult {
  publicUrl: string
  storagePath: string
}

export interface UploadProgressSnapshot {
  bytesUploaded: number
  bytesTotal: number
  /** 0-100, rounded */
  percent: number
  /** Estimated seconds remaining, or null until enough samples exist to estimate. */
  etaSeconds: number | null
}

export const PHOTO_UPLOAD_TIMEOUT_MS = 45_000

// Matches app/create/page.tsx's tuning (the two copies had drifted apart —
// 2026-08-16: unified on the more generous create-page values since that's
// the surface real large-video uploads go through).
const VIDEO_UPLOAD_TIMEOUT_FLOOR_MS = 120_000   // 2 min minimum
const VIDEO_UPLOAD_TIMEOUT_CAP_MS = 900_000     // 15 min maximum
const VIDEO_UPLOAD_MS_PER_MB = 3_000            // ≈333 KB/s sustained-throughput budget

export function getVideoUploadTimeoutMs(fileSizeBytes: number): number {
  const sizeMb = fileSizeBytes / (1024 * 1024)
  const scaled = VIDEO_UPLOAD_TIMEOUT_FLOOR_MS + sizeMb * VIDEO_UPLOAD_MS_PER_MB
  return Math.min(VIDEO_UPLOAD_TIMEOUT_CAP_MS, Math.max(VIDEO_UPLOAD_TIMEOUT_FLOOR_MS, scaled))
}

/** Videos at/above this size use the resumable TUS transport instead of a single request. */
export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 20 * 1024 * 1024 // 20 MB

function encodeStoragePath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

function getSupabaseConfig(): { supabaseUrl: string; anonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase upload config is missing')
  }
  return { supabaseUrl, anonKey }
}

/**
 * Rolling-average progress tracker shared by both upload transports.
 *
 * Speed is sampled at most every 250ms (chunk/progress events can fire much
 * more often than that, especially near the end of a request, which would
 * otherwise make the ETA jitter wildly) and smoothed with an exponential
 * moving average so the "~Ns left" estimate doesn't jump around on every
 * event. Returns null for etaSeconds until at least one real speed sample
 * has been taken.
 */
export function createUploadProgressTracker(
  bytesTotal: number,
  onUpdate: (snapshot: UploadProgressSnapshot) => void,
) {
  const startedAt = Date.now()
  let lastSampleAt = startedAt
  let lastSampleBytes = 0
  let smoothedBytesPerSec: number | null = null

  return {
    report(bytesUploaded: number) {
      const now = Date.now()
      const dtMs = now - lastSampleAt
      if (dtMs >= 250 || bytesUploaded >= bytesTotal) {
        const dBytes = bytesUploaded - lastSampleBytes
        if (dBytes > 0 && dtMs > 0) {
          const instantaneousBps = (dBytes / dtMs) * 1000
          smoothedBytesPerSec = smoothedBytesPerSec == null
            ? instantaneousBps
            : smoothedBytesPerSec * 0.7 + instantaneousBps * 0.3
        }
        lastSampleAt = now
        lastSampleBytes = bytesUploaded
      }

      const percent = bytesTotal > 0 ? Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100)) : 0
      const remainingBytes = Math.max(0, bytesTotal - bytesUploaded)
      const etaSeconds = smoothedBytesPerSec && smoothedBytesPerSec > 0
        ? Math.max(0, Math.round(remainingBytes / smoothedBytesPerSec))
        : null

      onUpdate({ bytesUploaded, bytesTotal, percent, etaSeconds })
    },
  }
}

/** Formats a snapshot into a short human string, e.g. "42% · ~12s left". */
export function formatUploadProgress(snapshot: UploadProgressSnapshot): string {
  const pct = `${snapshot.percent}%`
  if (snapshot.etaSeconds == null) return pct
  if (snapshot.etaSeconds <= 1) return `${pct} · almost done`
  if (snapshot.etaSeconds < 60) return `${pct} · ~${snapshot.etaSeconds}s left`
  const mins = Math.floor(snapshot.etaSeconds / 60)
  const secs = snapshot.etaSeconds % 60
  return `${pct} · ~${mins}m ${secs}s left`
}

export async function uploadToSupabaseStorageDirect(params: {
  bucket: string
  storagePath: string
  file: File | Blob
  contentType: string
  accessToken: string
  timeoutMs: number
  onProgress?: (snapshot: UploadProgressSnapshot) => void
}): Promise<DirectStorageUploadResult> {
  const { supabaseUrl, anonKey } = getSupabaseConfig()

  const encodedPath = encodeStoragePath(params.storagePath)
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${params.bucket}/${encodedPath}`
  const bytesTotal = params.file.size
  const tracker = params.onProgress && bytesTotal > 0
    ? createUploadProgressTracker(bytesTotal, params.onProgress)
    : null

  return new Promise<DirectStorageUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let timedOut = false
    const timeout = window.setTimeout(() => {
      timedOut = true
      xhr.abort()
    }, params.timeoutMs)

    xhr.upload.onprogress = (e) => {
      if (tracker && e.lengthComputable) tracker.report(e.loaded)
    }

    xhr.onload = () => {
      window.clearTimeout(timeout)
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          publicUrl: `${supabaseUrl}/storage/v1/object/public/${params.bucket}/${encodedPath}`,
          storagePath: params.storagePath,
        })
        return
      }
      let detail = `${xhr.status} ${xhr.statusText}`.trim()
      try {
        const data = JSON.parse(xhr.responseText) as { error?: string; message?: string }
        detail = data.error || data.message || detail
      } catch {
        if (xhr.responseText?.trim()) detail = xhr.responseText.slice(0, 180)
      }
      reject(new Error(detail))
    }

    xhr.onerror = () => {
      window.clearTimeout(timeout)
      reject(new Error('Network error during upload. Please check your connection and try again.'))
    }

    xhr.onabort = () => {
      window.clearTimeout(timeout)
      if (timedOut) {
        const seconds = Math.round(params.timeoutMs / 1000)
        reject(new Error(`Upload timed out after ${seconds}s. Please try again on Wi‑Fi or choose a smaller file.`))
      } else {
        reject(new Error('Upload cancelled.'))
      }
    }

    xhr.open('POST', uploadUrl, true)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('authorization', `Bearer ${params.accessToken}`)
    xhr.setRequestHeader('cache-control', '31536000')
    xhr.setRequestHeader('content-type', params.contentType)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.send(params.file)
  })
}

/**
 * Resolves the direct storage hostname Supabase recommends for large
 * resumable uploads (`<ref>.storage.supabase.co` instead of
 * `<ref>.supabase.co`) when the project URL matches the standard hosted
 * pattern. Falls back to the configured URL unchanged for custom domains or
 * self-hosted projects, where the direct hostname doesn't apply.
 */
function resolveTusEndpoint(supabaseUrl: string): string {
  const match = supabaseUrl.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i)
  const base = match ? `https://${match[1]}.storage.supabase.co` : supabaseUrl
  return `${base}/storage/v1/upload/resumable`
}

/**
 * Resumable (TUS) upload for large videos. Chunk size is fixed at 6MB per
 * Supabase's current requirement — the protocol implementation on their
 * side is hard-coded to that part size, so any other value fails uploads.
 *
 * On a dropped connection, `tus-js-client`'s `retryDelays` reconnect and
 * resume from the last acknowledged chunk instead of restarting the whole
 * file, which is the real reliability/speed win for large mobile uploads.
 */
export async function uploadVideoResumable(params: {
  bucket: string
  storagePath: string
  file: File | Blob
  contentType: string
  accessToken: string
  timeoutMs: number
  onProgress?: (snapshot: UploadProgressSnapshot) => void
}): Promise<DirectStorageUploadResult> {
  const { supabaseUrl, anonKey } = getSupabaseConfig()
  const { Upload } = await import('tus-js-client')

  const encodedPath = encodeStoragePath(params.storagePath)
  const bytesTotal = params.file.size
  const tracker = params.onProgress && bytesTotal > 0
    ? createUploadProgressTracker(bytesTotal, params.onProgress)
    : null

  return new Promise<DirectStorageUploadResult>((resolve, reject) => {
    let settled = false
    let overallTimeout: number | null = null

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      if (overallTimeout != null) window.clearTimeout(overallTimeout)
      fn()
    }

    const upload = new Upload(params.file, {
      endpoint: resolveTusEndpoint(supabaseUrl),
      retryDelays: [0, 1000, 3000, 5000, 10000],
      chunkSize: 6 * 1024 * 1024, // must stay 6MB — Supabase's TUS endpoint requires this exact part size
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${params.accessToken}`,
        'x-upsert': 'false',
      },
      metadata: {
        bucketName: params.bucket,
        objectName: params.storagePath,
        contentType: params.contentType,
        cacheControl: '31536000',
      },
      onError: (error) => {
        finish(() => reject(error instanceof Error ? error : new Error(String(error))))
      },
      onProgress: (bytesUploaded) => {
        if (tracker) tracker.report(bytesUploaded)
      },
      onSuccess: () => {
        finish(() => resolve({
          publicUrl: `${supabaseUrl}/storage/v1/object/public/${params.bucket}/${encodedPath}`,
          storagePath: params.storagePath,
        }))
      },
    })

    // Overall wall-clock timeout so a stalled upload (e.g. server never
    // responding, retries exhausted) doesn't leave the UI stuck forever —
    // mirrors the single-shot transport's timeout behavior.
    overallTimeout = window.setTimeout(() => {
      finish(() => {
        upload.abort(true).catch(() => { /* best-effort */ })
        const seconds = Math.round(params.timeoutMs / 1000)
        reject(new Error(`Upload timed out after ${seconds}s. Please try again on Wi‑Fi or choose a smaller file.`))
      })
    }, params.timeoutMs)

    upload.findPreviousUploads()
      .then((previousUploads) => {
        if (previousUploads.length > 0) {
          upload.resumeFromPreviousUpload(previousUploads[0])
        }
        upload.start()
      })
      .catch(() => {
        // If lookup fails for any reason, just start fresh rather than blocking the upload.
        upload.start()
      })
  })
}

export interface ImageCompressionOptions {
  /** Longest edge in pixels the output image will be capped to. Images already smaller are not upscaled. */
  maxDimension?: number
  /** JPEG/WebP quality, 0-1. Ignored for GIFs (animated GIFs are passed through untouched). */
  quality?: number
  /** Preferred output MIME type. Falls back to the original file's type if the browser can't encode it. */
  preferredMimeType?: 'image/webp' | 'image/jpeg'
}

const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.82

/**
 * Resizes and re-encodes a still image client-side (canvas-based, no extra
 * dependency) before upload, so large camera/AI-generated images don't ship
 * multi-megabyte originals straight to Storage. Deliberately still-image
 * only — do not call this for video files.
 *
 * Skips GIFs (canvas re-encode would flatten animation to a single frame)
 * and HEIC/HEIF (canvas can't reliably decode these in most browsers; they
 * pass through unchanged and rely on Supabase/downstream handling, same as
 * before this function existed).
 *
 * On any failure (canvas unsupported, decode error, toBlob failure) this
 * resolves with the ORIGINAL file rather than throwing — a failed
 * compression attempt should never block a real upload the user is waiting
 * on. Also resolves with the original file unchanged if the compressed
 * result would somehow be larger (can happen with already-optimized small
 * source images) or if the source is already at/under both the target
 * dimension and a sane size floor, to avoid pointless re-encoding.
 */
export async function compressImageForUpload(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<File> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options.quality ?? DEFAULT_QUALITY

  const skipTypes = ['image/gif', 'image/heic', 'image/heif']
  if (skipTypes.includes(file.type)) return file

  // Small files are almost certainly already reasonably sized (e.g. a
  // pre-cropped avatar) — skip the decode/re-encode round trip entirely.
  const SKIP_BELOW_BYTES = 300 * 1024 // 300 KB
  if (file.size <= SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap
    const longestEdge = Math.max(width, height)
    const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close?.()

    const preferredType = options.preferredMimeType ?? 'image/webp'
    const outputType = await canvasSupportsEncoding(canvas, preferredType) ? preferredType : 'image/jpeg'

    const blob: Blob | null = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), outputType, quality)
    })
    if (!blob) return file

    // Only use the compressed result if it's actually smaller — a tiny or
    // already-optimized source image can occasionally re-encode larger.
    if (blob.size >= file.size) return file

    const ext = outputType === 'image/webp' ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^./]+$/, '') || 'image'
    return new File([blob], `${baseName}.${ext}`, { type: outputType, lastModified: Date.now() })
  } catch {
    // Decode/encode failed for any reason — fall back to the original file
    // rather than blocking the upload.
    return file
  }
}

/** Feature-detects canvas WebP encoding support (Safari < 14 lacks it). */
function canvasSupportsEncoding(canvas: HTMLCanvasElement, type: string): Promise<boolean> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(!!blob && blob.type === type), type, 0.5)
  })
}

/** Extracts the "<user_id>/<filename>" storage path from a public stories URL. */
export function storiesPathFromPublicUrl(mediaUrl: string): string | null {
  const marker = '/storage/v1/object/public/stories/'
  const idx = mediaUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(mediaUrl.slice(idx + marker.length))
}
