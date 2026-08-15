'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { uploadToSupabaseStorageDirect, getVideoUploadTimeoutMs, PHOTO_UPLOAD_TIMEOUT_MS } from '@/lib/storage/directUpload'
import { validateStoryFileSize, validateStoryVideo, resizeImageMaxWidth, getVideoDurationSeconds } from '@/lib/stories/mediaValidation'
import { MAX_STORY_IMAGE_WIDTH, DEFAULT_IMAGE_STORY_DURATION_SECONDS } from '@/types/stories'

export interface StoryCreateSheetProps {
  onClose: () => void
  onShared: () => void
}

type Stage = 'pick' | 'preview' | 'uploading' | 'done'

export default function StoryCreateSheet({ onClose, onShared }: StoryCreateSheetProps) {
  const [stage, setStage] = useState<Stage>('pick')
  const [file, setFile] = useState<File | null>(null)
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [error, setError] = useState('')
  const [progressLabel, setProgressLabel] = useState('')
  const [progressPct, setProgressPct] = useState(0)

  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const videoInputRef = useRef<HTMLInputElement | null>(null)
  const galleryInputRef = useRef<HTMLInputElement | null>(null)

  const handlePicked = async (picked: File) => {
    setError('')
    const isVideo = picked.type.startsWith('video/')
    const isImage = picked.type.startsWith('image/')
    if (!isVideo && !isImage) {
      setError('Unsupported file type — please choose a photo or video.')
      return
    }

    const sizeCheck = validateStoryFileSize(picked)
    if (!sizeCheck.ok) {
      setError(sizeCheck.error!)
      return
    }

    if (isVideo) {
      const videoCheck = await validateStoryVideo(picked)
      if (!videoCheck.ok) {
        setError(videoCheck.error!)
        return
      }
      setMediaType('video')
      setFile(picked)
      setPreviewUrl(URL.createObjectURL(picked))
      setStage('preview')
    } else {
      const resized = await resizeImageMaxWidth(picked, MAX_STORY_IMAGE_WIDTH)
      setMediaType('image')
      setFile(resized)
      setPreviewUrl(URL.createObjectURL(resized))
      setStage('preview')
    }
  }

  const handleShare = async () => {
    if (!file) return
    setStage('uploading')
    setError('')
    setProgressLabel('Preparing…')
    setProgressPct(10)

    try {
      const supabase = createClient()
      const [{ data: { user } }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ])
      if (!user) {
        setError('Please sign in and try again.')
        setStage('preview')
        return
      }
      const accessToken = sessionData.session?.access_token
      if (!accessToken) {
        setError('Your session was not ready. Please refresh and try again.')
        setStage('preview')
        return
      }

      const ext = mediaType === 'video' ? (file.name.split('.').pop() || 'mp4') : 'jpg'
      const rand = Math.random().toString(36).slice(2)
      const storagePath = `${user.id}/${Date.now()}-${rand}.${ext}`

      setProgressLabel(`Uploading ${mediaType}…`)
      setProgressPct(35)

      const { publicUrl } = await uploadToSupabaseStorageDirect({
        bucket: 'stories',
        storagePath,
        file,
        contentType: file.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
        accessToken,
        timeoutMs: mediaType === 'video' ? getVideoUploadTimeoutMs(file.size) : PHOTO_UPLOAD_TIMEOUT_MS,
      })

      setProgressPct(75)
      setProgressLabel('Publishing…')

      let durationSeconds = DEFAULT_IMAGE_STORY_DURATION_SECONDS
      if (mediaType === 'video') {
        const d = await getVideoDurationSeconds(file)
        durationSeconds = d ? Math.min(30, Math.max(1, Math.round(d))) : 15
      }

      const res = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_url: publicUrl,
          media_type: mediaType,
          caption: caption.trim() || null,
          duration_seconds: durationSeconds,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not publish your Story — please try again.')
        setStage('preview')
        return
      }

      setProgressPct(100)
      setStage('done')
      setTimeout(() => { onShared(); onClose() }, 1400)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed — please try again.')
      setStage('preview')
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
      onClick={() => stage !== 'uploading' && onClose()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 480, background: 'linear-gradient(180deg,var(--ft-surface),var(--ft-bg))', border: '1px solid var(--ft-surface)', borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto' }}
      >
        <div style={{ width: 40, height: 4, borderRadius: 999, background: 'var(--ft-text-faint)', margin: '0.8rem auto 0.2rem' }} />
        <div style={{ textAlign: 'center', fontWeight: 700, color: 'var(--ft-text)', padding: '0.6rem 0 1rem', borderBottom: '1px solid var(--ft-surface)' }}>
          {stage === 'uploading' ? 'Uploading…' : stage === 'done' ? 'Story shared!' : 'New Story'}
        </div>

        {stage === 'pick' && (
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => photoInputRef.current?.click()} style={pickerBtnStyle}>
                <span style={{ fontSize: '1.4rem' }}>📷</span>Camera
              </button>
              <button onClick={() => galleryInputRef.current?.click()} style={pickerBtnStyle}>
                <span style={{ fontSize: '1.4rem' }}>🖼</span>Gallery
              </button>
              <button onClick={() => videoInputRef.current?.click()} style={pickerBtnStyle}>
                <span style={{ fontSize: '1.4rem' }}>🎬</span>Video
              </button>
            </div>
            {error && <div style={errorStyle}>{error}</div>}
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={e => e.target.files?.[0] && handlePicked(e.target.files[0])} />
            <input ref={galleryInputRef} type="file" accept="image/*,video/*" hidden onChange={e => e.target.files?.[0] && handlePicked(e.target.files[0])} />
            <input ref={videoInputRef} type="file" accept="video/*" capture="environment" hidden onChange={e => e.target.files?.[0] && handlePicked(e.target.files[0])} />
          </div>
        )}

        {(stage === 'preview' || stage === 'uploading' || stage === 'done') && previewUrl && (
          <div style={{ padding: '1rem' }}>
            <div style={{ position: 'relative', height: 340, borderRadius: 16, overflow: 'hidden', background: '#000', display: 'flex', alignItems: 'flex-end' }}>
              {mediaType === 'image' ? (
                <img src={previewUrl} alt="Story preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              ) : (
                <video src={previewUrl} muted autoPlay loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              )}
              {stage === 'preview' && (
                <input
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, 240))}
                  placeholder="Add a caption…"
                  style={{ position: 'relative', zIndex: 2, width: '100%', margin: '0.9rem', background: 'rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 12, padding: '0.6rem 0.8rem', fontSize: 14, color: '#fff' }}
                />
              )}
            </div>

            {error && <div style={errorStyle}>{error}</div>}

            {stage === 'preview' && (
              <button onClick={handleShare} style={shareBtnStyle}>Share Story</button>
            )}

            {stage === 'uploading' && (
              <div style={{ padding: '0 0.1rem', marginTop: 14 }}>
                <div style={{ height: 8, background: 'var(--ft-bg)', border: '1px solid var(--ft-surface)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progressPct}%`, background: 'linear-gradient(90deg,var(--ft-accent),#00d4aa)', borderRadius: 999, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--ft-text-tertiary)', marginTop: 6, textAlign: 'center' }}>{progressLabel}</div>
              </div>
            )}

            {stage === 'done' && (
              <div style={{ marginTop: 14, padding: '0.6rem 0.8rem', borderRadius: 12, background: 'rgba(6,214,160,.12)', border: '1px solid rgba(6,214,160,.35)', color: '#06d6a0', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                ✅ Story shared! Visible to your connections for 24h.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const pickerBtnStyle: React.CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
  padding: '0.9rem 0.5rem', borderRadius: 12, background: 'var(--ft-bg)', border: '1px solid var(--ft-surface)',
  fontSize: 12, color: 'var(--ft-text-tertiary)', fontWeight: 600,
}

const shareBtnStyle: React.CSSProperties = {
  width: '100%', marginTop: 14, padding: '0.85rem', borderRadius: 12, textAlign: 'center', fontWeight: 700,
  fontSize: 14, color: 'var(--ft-bg)', background: 'linear-gradient(135deg,var(--ft-accent),#00d4aa)',
}

const errorStyle: React.CSSProperties = {
  marginTop: 10, fontSize: 12.5, color: '#ff4d6d', background: 'rgba(255,77,109,.1)',
  border: '1px solid rgba(255,77,109,.3)', borderRadius: 10, padding: '0.55rem 0.7rem',
}
