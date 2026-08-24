'use client'
import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { uploadToSupabaseStorageDirect, PHOTO_UPLOAD_TIMEOUT_MS, compressImageForUpload, type UploadProgressSnapshot } from '@/lib/storage/directUpload'

const CATEGORIES = ['Business', 'Technology', 'Sustainability', 'Design', 'Finance', 'Community']

const FEATURED_IMAGE_BUCKET = 'feed-media'
const FEATURED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
const FEATURED_IMAGE_EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}
const MAX_FEATURED_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB — matches the app's other image upload limits

// Perf/UX fix (2026-08-23): publishing was perceived as "taking too long."
// Live timing against production showed the actual insert is fast
// (~500-750ms round trip) — the real cost was downstream: a full extra
// auth.getUser() network validation round trip on the critical path, and
// the destination article page (app/articles/[slug]/page.tsx) doing
// several sequential (not parallel) Supabase reads after the redirect,
// which is fixed separately in that file. This page drops the redundant
// getUser() round trip in favor of the already-cached local session — safe
// because the DB's RLS policy `with check (auth.uid() = author_id)`
// independently enforces the real author server-side regardless of what
// the client sends — and adds a hard client-side timeout plus a
// "still working" elapsed-time hint so a genuinely slow network never
// just looks silently hung with only a static "Publishing…" label.
const PUBLISH_TIMEOUT_MS = 25_000
const SLOW_HINT_MS = 6_000

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (!text) return 0
  return text.split(' ').filter(Boolean).length
}

function estimateReadTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / 200))
}

type ToastType = 'success' | 'error'

function NewArticleInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const draftId = searchParams.get('draft')

  const [title, setTitle] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [featuredImage, setFeaturedImage] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [imageUploadProgress, setImageUploadProgress] = useState<UploadProgressSnapshot | null>(null)
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const featuredImageInputRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(null)
  const [elapsedHint, setElapsedHint] = useState<string | null>(null)
  const [wordCount, setWordCount] = useState(0)
  const editorRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  // Load draft if draftId provided
  useEffect(() => {
    if (!draftId) return
    const load = async () => {
      const { data } = await supabase.from('articles').select('*').eq('id', draftId).single()
      if (data) {
        setTitle(data.title ?? '')
        setExcerpt(data.excerpt ?? '')
        setCategory(data.category ?? CATEGORIES[0])
        setTags(data.tags ?? [])
        setFeaturedImage(data.featured_image_url ?? '')
        if (editorRef.current) editorRef.current.innerHTML = data.body ?? ''
        setWordCount(countWords(data.body ?? ''))
      }
    }
    load()
  }, [draftId])

  const handleEditorInput = () => {
    const html = editorRef.current?.innerHTML ?? ''
    setWordCount(countWords(html))
  }

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
  }

  const insertBlock = (tag: string) => {
    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    const el = document.createElement(tag)
    el.innerHTML = '<br>'
    range.insertNode(el)
    const newRange = document.createRange()
    newRange.setStart(el, 0)
    newRange.collapse(true)
    sel.removeAllRanges()
    sel.addRange(newRange)
    editorRef.current?.focus()
  }

  const addTag = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (t && !tags.includes(t) && tags.length < 10) setTags(prev => [...prev, t])
    setTagInput('')
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) setTags(prev => prev.slice(0, -1))
  }

  const getBody = () => editorRef.current?.innerHTML ?? ''

  // Featured image upload — real media upload (2026-08-23 fix), replacing
  // the old raw-URL text field. Uploads direct-to-Supabase-Storage from the
  // browser (same transport as other image uploads in this app, see
  // lib/storage/directUpload.ts), storing into the existing public
  // `feed-media` bucket under `article-covers/<user_id>/<filename>` — this
  // matches that bucket's existing RLS path convention
  // (`(storage.foldername(name))[2] = auth.uid()::text`), so no new bucket
  // or migration is needed. The resulting public URL is written into the
  // same `featured_image_url` field the rest of the app already expects.
  //
  // 2026-08-24: images are resized/re-encoded client-side via
  // compressImageForUpload() before the upload call. A real published
  // article previously shipped 5 AI-generated PNGs totalling ~8.3MB with no
  // compression step, which was the actual cause of that article's page
  // loading slowly — see .memory/capabilities/freetrust-article-editor.md.
  // compressImageForUpload() safely falls back to the original file on any
  // failure (unsupported browser, decode error, etc.), so this never blocks
  // a real upload.
  const uploadFeaturedImage = async (file: File) => {
    setImageUploadError(null)

    if (!FEATURED_IMAGE_TYPES.includes(file.type)) {
      setImageUploadError('Please choose an image file (jpg, png, webp, gif, or heic).')
      return
    }
    if (file.size > MAX_FEATURED_IMAGE_BYTES) {
      setImageUploadError(`Image is too large (max ${Math.round(MAX_FEATURED_IMAGE_BYTES / 1024 / 1024)} MB).`)
      return
    }

    const uploadFile = await compressImageForUpload(file, { maxDimension: 1600, quality: 0.82 })

    setImageUploading(true)
    setImageUploadProgress({ bytesUploaded: 0, bytesTotal: uploadFile.size, percent: 0, etaSeconds: null })

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const accessToken = session?.access_token
      const userId = session?.user?.id
      if (!accessToken || !userId) {
        setImageUploadError('Please sign in again to upload an image.')
        return
      }

      const ext = FEATURED_IMAGE_EXT_BY_MIME[uploadFile.type] ?? FEATURED_IMAGE_EXT_BY_MIME[file.type] ?? 'jpg'
      const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const storagePath = `article-covers/${userId}/${safeName}`

      const result = await uploadToSupabaseStorageDirect({
        bucket: FEATURED_IMAGE_BUCKET,
        storagePath,
        file: uploadFile,
        contentType: uploadFile.type,
        accessToken,
        timeoutMs: PHOTO_UPLOAD_TIMEOUT_MS,
        onProgress: setImageUploadProgress,
      })

      setFeaturedImage(result.publicUrl)
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Image upload failed. Please try again.')
    } finally {
      setImageUploading(false)
      setImageUploadProgress(null)
    }
  }

  const handleFeaturedImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadFeaturedImage(file)
    e.target.value = ''
  }

  const handleFeaturedImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFeaturedImage(file)
  }

  const submit = async (status: 'draft' | 'published') => {
    if (!title.trim()) { showToast('Please add a title', 'error'); return }
    const body = getBody()
    if (!body.trim() || body === '<br>') { showToast('Please write some content', 'error'); return }

    if (status === 'published') setPublishing(true); else setSaving(true)
    setElapsedHint(null)

    const slowHintTimer = window.setTimeout(() => {
      setElapsedHint(status === 'published' ? 'Still publishing… hang tight, this can take a few extra seconds on a slow connection.' : 'Still saving…')
    }, SLOW_HINT_MS)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { showToast('Please sign in to publish', 'error'); return }

      const baseSlug = slugify(title)
      const suffix = Math.random().toString(36).slice(2, 7)
      const slug = `${baseSlug}-${suffix}`
      const wc = countWords(body)

      const payload = {
        title: title.trim(),
        slug,
        excerpt: excerpt.trim() || undefined,
        body,
        featured_image_url: featuredImage.trim() || undefined,
        status,
        category,
        tags,
        read_time_minutes: estimateReadTime(wc),
        author_id: user.id,
      }

      const dbCall = draftId
        ? supabase.from('articles').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', draftId).select().single()
        : supabase.from('articles').insert(payload).select().single()

      // Hard timeout so a genuinely stalled request surfaces a real error
      // instead of leaving the button stuck on "Publishing…" forever.
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error(`This is taking unusually long (>${Math.round(PUBLISH_TIMEOUT_MS / 1000)}s). Please check your connection and try again.`)), PUBLISH_TIMEOUT_MS)
      })
      const result = await Promise.race([dbCall, timeout])

      if (result.error) {
        if (result.error.code === '42P01' || result.error.message?.includes('relation') || result.error.message?.includes('does not exist')) {
          throw new Error('Articles table not yet created. Ask your admin to run the articles-schema.sql migration in Supabase.')
        }
        throw result.error
      }

      if (status === 'published') {
        showToast('Article published! ₮20 Trust earned 🎉', 'success')
        setTimeout(() => router.push(`/articles/${result.data.slug}`), 700)
      } else {
        showToast('Draft saved ✓', 'success')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      showToast(msg, 'error')
    } finally {
      window.clearTimeout(slowHintTimer)
      setElapsedHint(null)
      setSaving(false)
      setPublishing(false)
    }
  }

  const readTime = estimateReadTime(wordCount)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: 'var(--ft-bg)', color: 'var(--ft-text)', fontFamily: 'system-ui' }}>
      <style>{`
        .editor-toolbar button { background: transparent; border: 1px solid rgba(148,163,184,0.15); border-radius: 5px; color: var(--ft-text-secondary); padding: 0.3rem 0.55rem; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .editor-toolbar button:hover { background: rgba(56,189,248,0.1); color: var(--ft-accent); border-color: rgba(56,189,248,0.3); }
        .editor-area { outline: none; min-height: 320px; font-size: 1rem; line-height: 1.8; color: #e2e8f0; }
        .editor-area h2 { font-size: 1.5rem; font-weight: 700; margin: 1.25rem 0 0.5rem; color: var(--ft-text); }
        .editor-area h3 { font-size: 1.2rem; font-weight: 600; margin: 1rem 0 0.4rem; color: var(--ft-text); }
        .editor-area blockquote { border-left: 3px solid var(--ft-accent); padding-left: 1rem; margin: 1rem 0; color: var(--ft-text-secondary); font-style: italic; }
        .editor-area ul, .editor-area ol { padding-left: 1.5rem; margin: 0.75rem 0; }
        .editor-area li { margin-bottom: 0.3rem; }
        .editor-area pre, .editor-area code { background: var(--ft-bg); border: 1px solid rgba(56,189,248,0.15); border-radius: 6px; padding: 0.8rem 1rem; font-family: monospace; font-size: 0.88rem; color: var(--ft-accent); display: block; margin: 0.75rem 0; white-space: pre-wrap; }
        .editor-area a { color: var(--ft-accent); text-decoration: underline; }
        .editor-area:empty:before { content: attr(data-placeholder); color: var(--ft-text-faint); pointer-events: none; }
        .tag-pill { display: inline-flex; align-items: center; gap: 0.3rem; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); border-radius: 999px; padding: 0.2rem 0.7rem; font-size: 0.8rem; color: var(--ft-accent); }
        .tag-pill button { background: none; border: none; cursor: pointer; color: var(--ft-text-tertiary); font-size: 0.9rem; padding: 0; line-height: 1; }
        .tag-pill button:hover { color: #ef4444; }
        .new-art-input { background: var(--ft-surface); border: 1px solid rgba(56,189,248,0.15); border-radius: 8px; color: var(--ft-text); font-family: inherit; transition: border-color 0.15s; width: 100%; box-sizing: border-box; }
        .new-art-input:focus { outline: none; border-color: rgba(56,189,248,0.4); }
        .new-art-select { background: var(--ft-surface); border: 1px solid rgba(56,189,248,0.15); border-radius: 8px; color: var(--ft-text); font-family: inherit; padding: 0.55rem 0.85rem; font-size: 0.9rem; cursor: pointer; }
        .new-art-select:focus { outline: none; border-color: rgba(56,189,248,0.4); }
        .pub-btn { background: var(--ft-accent); border: none; border-radius: 8px; padding: 0.65rem 1.5rem; font-size: 0.9rem; font-weight: 700; color: var(--ft-bg); cursor: pointer; transition: opacity 0.15s; }
        .pub-btn:hover { opacity: 0.88; }
        .pub-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .draft-btn { background: transparent; border: 1px solid rgba(148,163,184,0.2); border-radius: 8px; padding: 0.65rem 1.2rem; font-size: 0.9rem; font-weight: 600; color: var(--ft-text-secondary); cursor: pointer; transition: all 0.15s; }
        .draft-btn:hover { border-color: rgba(56,189,248,0.3); color: var(--ft-accent); }
        .draft-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        @keyframes slideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: toast.type === 'success' ? '#0f2a1a' : '#2a0f0f', border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.4)' : 'rgba(239,68,68,0.4)'}`, borderRadius: 10, padding: '0.75rem 1.5rem', color: toast.type === 'success' ? '#34d399' : 'var(--ft-danger)', fontWeight: 600, fontSize: '0.9rem', animation: 'slideIn 0.2s ease', whiteSpace: 'nowrap' }}>
          {toast.msg}
        </div>
      )}

      {/* Slow-network elapsed hint — only shows if publish/save is taking longer than expected */}
      {elapsedHint && (saving || publishing) && (
        <div style={{ position: 'fixed', top: toast ? 130 : 76, left: '50%', transform: 'translateX(-50%)', zIndex: 9998, background: 'rgba(15,23,42,0.92)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '0.6rem 1.25rem', color: 'var(--ft-text-secondary)', fontWeight: 500, fontSize: '0.82rem', animation: 'slideIn 0.2s ease', whiteSpace: 'nowrap' }}>
          {elapsedHint}
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.15rem' }}>{draftId ? 'Edit Draft' : 'Write Article'}</h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--ft-text-tertiary)' }}>
              {wordCount} words · {readTime} min read
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button className="draft-btn" disabled={saving || publishing || imageUploading} onClick={() => submit('draft')}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button className="pub-btn" disabled={saving || publishing || imageUploading} onClick={() => submit('published')}>
              {publishing ? 'Publishing…' : 'Publish — Earn ₮20'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title *</label>
            <input
              className="new-art-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Your article title…"
              style={{ padding: '0.85rem 1rem', fontSize: '1.3rem', fontWeight: 700 }}
            />
          </div>

          {/* Excerpt */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excerpt</label>
            <textarea
              className="new-art-input"
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              placeholder="A short description shown in article listings (1–2 sentences)…"
              rows={2}
              style={{ padding: '0.7rem 1rem', fontSize: '0.9rem', resize: 'vertical' }}
            />
          </div>

          {/* Category + Tags row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category</label>
              <select className="new-art-select" value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags (max 10)</label>
              <div style={{ background: 'var(--ft-surface)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.45rem 0.7rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center', minHeight: 42 }}>
                {tags.map(t => (
                  <span key={t} className="tag-pill">
                    #{t}
                    <button onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                  </span>
                ))}
                {tags.length < 10 && (
                  <input
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={() => tagInput && addTag(tagInput)}
                    placeholder={tags.length === 0 ? 'Add tags (Enter or comma)' : '+'}
                    style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--ft-text)', fontSize: '0.82rem', minWidth: 80, flex: 1 }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Featured image */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Featured Image</label>
            <input
              ref={featuredImageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              onChange={handleFeaturedImageInputChange}
              style={{ display: 'none' }}
            />

            {featuredImage && !imageUploading ? (
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', maxHeight: 220, border: '1px solid rgba(56,189,248,0.15)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={featuredImage} alt="Featured preview" style={{ width: '100%', objectFit: 'cover', maxHeight: 220, display: 'block' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={() => featuredImageInputRef.current?.click()}
                    style={{ background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(148,163,184,0.3)', borderRadius: 6, color: 'var(--ft-text)', fontSize: '0.75rem', fontWeight: 600, padding: '0.35rem 0.7rem', cursor: 'pointer' }}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeaturedImage('')}
                    style={{ background: 'rgba(42,15,15,0.85)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 6, color: '#f87171', fontSize: '0.75rem', fontWeight: 600, padding: '0.35rem 0.7rem', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => !imageUploading && featuredImageInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleFeaturedImageDrop}
                style={{
                  border: '1.5px dashed rgba(56,189,248,0.3)',
                  borderRadius: 10,
                  padding: '1.75rem 1rem',
                  textAlign: 'center',
                  cursor: imageUploading ? 'default' : 'pointer',
                  background: 'var(--ft-surface)',
                  transition: 'border-color 0.15s',
                }}
              >
                {imageUploading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ft-text-secondary)', fontWeight: 600 }}>
                      Uploading… {imageUploadProgress?.percent ?? 0}%
                    </div>
                    <div style={{ width: '60%', height: 6, background: 'rgba(148,163,184,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${imageUploadProgress?.percent ?? 0}%`, height: '100%', background: 'var(--ft-accent)', transition: 'width 0.15s' }} />
                    </div>
                    {imageUploadProgress?.etaSeconds != null && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--ft-text-tertiary)' }}>~{imageUploadProgress.etaSeconds}s left</div>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📷</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ft-text-secondary)', fontWeight: 600 }}>Click to upload or drag an image here</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ft-text-tertiary)', marginTop: '0.2rem' }}>JPG, PNG, WEBP, GIF, or HEIC — max 10 MB</div>
                  </>
                )}
              </div>
            )}
            {imageUploadError && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--ft-danger)' }}>{imageUploadError}</div>
            )}
          </div>

          {/* Rich text editor */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ft-text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Content *</label>
            <div style={{ background: 'var(--ft-surface)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Toolbar */}
              <div className="editor-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', padding: '0.65rem 0.85rem', borderBottom: '1px solid rgba(56,189,248,0.1)', background: 'rgba(15,23,42,0.5)' }}>
                <button onMouseDown={e => { e.preventDefault(); execCmd('bold') }} title="Bold"><b>B</b></button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('italic') }} title="Italic"><i>I</i></button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'h2') }} title="Heading 2">H2</button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'h3') }} title="Heading 3">H3</button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('formatBlock', 'blockquote') }} title="Blockquote">&ldquo;&rdquo;</button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList') }} title="Bullet list">• List</button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList') }} title="Numbered list">1. List</button>
                <button onMouseDown={e => { e.preventDefault(); insertBlock('pre') }} title="Code block">{`</>`}</button>
                <button onMouseDown={e => {
                  e.preventDefault()
                  const url = window.prompt('Enter URL:')
                  if (url) execCmd('createLink', url)
                }} title="Link">🔗</button>
                <button onMouseDown={e => { e.preventDefault(); execCmd('removeFormat') }} title="Clear formatting" style={{ marginLeft: 'auto' }}>✕ Clear</button>
              </div>
              {/* Editor area */}
              <div
                ref={editorRef}
                className="editor-area"
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                data-placeholder="Start writing your article here… Use the toolbar above for formatting."
                style={{ padding: '1.25rem 1.25rem 1.5rem', minHeight: 320 }}
              />
            </div>
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--ft-text-faint)', marginTop: '0.4rem' }}>
              {wordCount} words · ~{readTime} min read
            </div>
          </div>

          {/* Trust reward notice */}
          <div style={{ background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.25rem' }}>₮</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--ft-accent)' }}>Earn ₮20 Trust when you publish</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--ft-text-tertiary)' }}>Publishing articles builds your reputation and rewards you with Trust tokens.</div>
            </div>
          </div>

          {/* Bottom action row */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem' }}>
            <button className="draft-btn" disabled={saving || publishing || imageUploading} onClick={() => submit('draft')}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button className="pub-btn" disabled={saving || publishing || imageUploading} onClick={() => submit('published')}>
              {publishing ? 'Publishing…' : 'Publish Article'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewArticlePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: 'calc(100vh - 58px)', background: 'var(--ft-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ft-text-tertiary)' }}>
        Loading editor…
      </div>
    }>
      <NewArticleInner />
    </Suspense>
  )
}
