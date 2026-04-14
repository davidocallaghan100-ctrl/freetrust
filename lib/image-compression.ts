'use client'

// ────────────────────────────────────────────────────────────────────────────
// Client-side image compression — Canvas 2D re-encode to JPEG
// ────────────────────────────────────────────────────────────────────────────
//
// Fixes HTTP 413 uploads on mobile: iPhone / Android camera photos are
// typically 8–15 MB, which exceeds Vercel's 4.5 MB serverless request
// body limit on Hobby plans. Compressing to ~2 MB on the client before
// sending means /api/upload/media never sees a body big enough for Vercel
// to reject at the edge.
//
// Called from every image upload site in the app:
//   * app/products/new/page.tsx          — product photos
//   * app/products/[id]/edit/page.tsx    — product photo replace/add
//   * app/grassroots/new/page.tsx        — grassroots listing photos
//   * app/seller/gigs/create/page.tsx    — gig cover + gallery
//   * app/onboarding/page.tsx            — avatar + cover photo
//
// Algorithm:
//   1. Bail out for non-images, GIFs (would lose animation), and files
//      already under `maxSizeMB` — no point re-encoding a 300 KB avatar.
//   2. Load the file into an HTMLImageElement via URL.createObjectURL.
//   3. Compute a uniform scale factor. Canvas output size scales roughly
//      with pixel count, so sqrt of the byte-ratio is a good heuristic:
//        scale = sqrt(maxBytes / originalBytes)
//   4. Draw to canvas at the new size.
//   5. Re-encode as JPEG at quality 0.85 via canvas.toBlob().
//   6. Wrap the Blob in a new File with a `.jpg` filename so downstream
//      code (server MIME validation, extension sniffing) sees consistent
//      metadata regardless of what the camera originally wrote.
//
// Fail-safe: if anything goes wrong — the browser can't decode HEIC via
// <img> (Chrome / Firefox), canvas.toBlob returns null, the 2d context
// is missing, or a 15-second timer expires — we resolve with the ORIGINAL
// file. The upload still gets attempted; /api/upload/media will then
// return a clean "File too large" or "Unsupported type" error, which is
// much better than hanging the submit button forever.

const DEFAULT_MAX_MB = 2

export async function compressImage(
  file: File,
  maxSizeMB: number = DEFAULT_MAX_MB,
): Promise<File> {
  // Non-images pass through (videos, PDFs, etc.)
  if (!file.type || !file.type.startsWith('image/')) return file

  // Already small enough — don't waste a canvas round-trip
  const maxBytes = maxSizeMB * 1024 * 1024
  if (file.size <= maxBytes) return file

  // GIFs: canvas re-encoding would drop every frame except the first,
  // so we skip them. A 10 MB GIF will still upload as-is and hit
  // Vercel's 4.5 MB limit — but that's better than silently producing
  // a one-frame still image the user didn't ask for.
  if (file.type === 'image/gif') return file

  return new Promise<File>((resolve) => {
    let settled = false
    const objectUrl = URL.createObjectURL(file)

    const finish = (result: File) => {
      if (settled) return
      settled = true
      try { URL.revokeObjectURL(objectUrl) } catch { /* ignore */ }
      resolve(result)
    }

    // 15-second safety timer — if an HEIC decode stalls, the tab is
    // backgrounded, or anything else hangs, we fall back to the
    // original file instead of leaving the submit button spinning
    // forever.
    const timer = setTimeout(() => {
      console.warn('[compressImage] 15s timeout — falling back to original file:', file.name)
      finish(file)
    }, 15_000)

    const img = new Image()

    img.onerror = () => {
      clearTimeout(timer)
      // Most common cause: HEIC on Chrome/Firefox (no built-in decoder).
      // Fall back to the original so the upload still happens — the
      // server will then either accept it (under 4.5 MB) or return a
      // clean error.
      console.warn('[compressImage] img.onerror — falling back to original file:', file.name, file.type)
      finish(file)
    }

    img.onload = () => {
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return finish(file)

        // Square-root scale on the byte ratio. For a 12 MB photo with
        // maxBytes = 2 MB, scale ≈ 0.408 → output ~16 % of original
        // pixel count → JPEG 0.85 typically lands ~1.5 MB.
        const scale = Math.min(1, Math.sqrt(maxBytes / file.size))
        const width  = Math.max(1, Math.round(img.naturalWidth  * scale))
        const height = Math.max(1, Math.round(img.naturalHeight * scale))

        canvas.width  = width
        canvas.height = height
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              console.warn('[compressImage] canvas.toBlob returned null — fallback:', file.name)
              return finish(file)
            }
            // Consistent .jpg filename so server MIME/ext sniffing works
            const baseName = (file.name.replace(/\.[^.]+$/, '') || 'image')
              .replace(/[^\w.\-]/g, '_')
            const compressed = new File([blob], `${baseName}.jpg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            })
            // If compression somehow produced a BIGGER file than the
            // original (rare, but can happen for already-optimised PNGs
            // smaller than the canvas re-encode overhead), keep the
            // original so we never make things worse.
            if (compressed.size >= file.size) {
              console.log('[compressImage] compressed was not smaller, keeping original:', file.name)
              return finish(file)
            }
            console.log(
              '[compressImage]',
              file.name,
              `${(file.size / 1024 / 1024).toFixed(2)} MB`,
              '→',
              `${(compressed.size / 1024 / 1024).toFixed(2)} MB`,
              `(${Math.round((compressed.size / file.size) * 100)}%)`,
            )
            finish(compressed)
          },
          'image/jpeg',
          0.85,
        )
      } catch (err) {
        console.error('[compressImage] canvas re-encode threw:', err)
        finish(file)
      }
    }

    img.src = objectUrl
  })
}

/**
 * Compress an array of files in sequence. Use this instead of
 * `Promise.all(files.map(compressImage))` if you want to avoid decoding
 * multiple huge images simultaneously on low-RAM mobile devices.
 */
export async function compressImages(
  files: File[] | FileList,
  maxSizeMB: number = DEFAULT_MAX_MB,
): Promise<File[]> {
  const arr = Array.from(files)
  const out: File[] = []
  for (const f of arr) {
    out.push(await compressImage(f, maxSizeMB))
  }
  return out
}
