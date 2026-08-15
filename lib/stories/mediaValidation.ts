'use client'

// Client-side validation/compression helpers specific to Stories uploads.
// Distinct from lib/image-compression.ts (which targets a max FILE SIZE via
// a byte-ratio heuristic) because the Stories spec requires a max WIDTH
// (1080px) regardless of resulting file size, plus a hard reject above 25MB
// and a video duration cap of 30s enforced before upload.

import { MAX_STORY_UPLOAD_BYTES, MAX_STORY_VIDEO_SECONDS } from '@/types/stories'

export interface StoryFileValidationResult {
  ok: boolean
  error?: string
}

export function validateStoryFileSize(file: File): StoryFileValidationResult {
  if (file.size > MAX_STORY_UPLOAD_BYTES) {
    const mb = (MAX_STORY_UPLOAD_BYTES / 1024 / 1024).toFixed(0)
    return { ok: false, error: `That file is too large — Stories are capped at ${mb}MB. Try a shorter clip or a smaller photo.` }
  }
  return { ok: true }
}

/** Reads video duration via a hidden <video> element. Resolves null if it can't be determined. */
export function getVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    const url = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(url)
    const timeout = window.setTimeout(() => { cleanup(); resolve(null) }, 8000)
    video.onloadedmetadata = () => {
      window.clearTimeout(timeout)
      const duration = Number.isFinite(video.duration) ? video.duration : null
      cleanup()
      resolve(duration)
    }
    video.onerror = () => { window.clearTimeout(timeout); cleanup(); resolve(null) }
    video.src = url
  })
}

export async function validateStoryVideo(file: File): Promise<StoryFileValidationResult> {
  const sizeCheck = validateStoryFileSize(file)
  if (!sizeCheck.ok) return sizeCheck

  const duration = await getVideoDurationSeconds(file)
  if (duration !== null && duration > MAX_STORY_VIDEO_SECONDS + 0.5) {
    return { ok: false, error: `Videos for Stories are capped at ${MAX_STORY_VIDEO_SECONDS}s — this clip is ${Math.round(duration)}s. Please trim it and try again.` }
  }
  return { ok: true }
}

/** Resizes an image file so its widest side is at most maxWidth, re-encoding as JPEG. Falls back to the original file on any failure. */
export function resizeImageMaxWidth(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') {
      resolve(file)
      return
    }

    let settled = false
    const finish = (result: File) => { if (!settled) { settled = true; resolve(result) } }
    const timeout = window.setTimeout(() => finish(file), 15000)

    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      try {
        if (img.width <= maxWidth) {
          window.clearTimeout(timeout)
          URL.revokeObjectURL(url)
          finish(file)
          return
        }
        const scale = maxWidth / img.width
        const canvas = document.createElement('canvas')
        canvas.width = maxWidth
        canvas.height = Math.round(img.height * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) { window.clearTimeout(timeout); URL.revokeObjectURL(url); finish(file); return }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob((blob) => {
          window.clearTimeout(timeout)
          URL.revokeObjectURL(url)
          if (!blob) { finish(file); return }
          finish(new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.87)
      } catch {
        window.clearTimeout(timeout)
        URL.revokeObjectURL(url)
        finish(file)
      }
    }
    img.onerror = () => { window.clearTimeout(timeout); URL.revokeObjectURL(url); finish(file) }
    img.src = url
  })
}
