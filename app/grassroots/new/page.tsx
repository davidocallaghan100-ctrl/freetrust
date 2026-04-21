'use client'
import React, { useState, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'
import LocationPicker from '@/components/location/LocationPicker'
import { EMPTY_LOCATION, type StructuredLocation } from '@/lib/geo'
import { CURRENCIES, useCurrency, type CurrencyCode } from '@/context/CurrencyContext'
import {
  GRASSROOTS_CATEGORIES,
  GRASSROOTS_CATEGORIES_BY_SLUG,
  AVAILABILITY_OPTIONS,
  RATE_TYPE_OPTIONS,
  CONTACT_PREFERENCE_OPTIONS,
  GRASSROOTS_GREEN,
  type GrassrootsAvailability,
  type GrassrootsRateType,
  type ContactPreference,
} from '@/lib/grassroots/categories'

// ────────────────────────────────────────────────────────────────────────────
// Multi-step create page for /grassroots/new
// ────────────────────────────────────────────────────────────────────────────
//
// Six-step linear wizard:
//   1. Listing type     — offering vs seeking work
//   2. Category         — pick one of the 15 grassroots categories
//   3. Details          — title, description, photo upload (media bucket)
//   4. Rate             — amount, type, currency, ₮ accepted toggle
//   5. Location         — LocationPicker + availability selector
//   6. Contact          — preference + contact_value, then submit
//
// Each step has its own validation and a Back button. The progress bar
// at the top shows N / 6 with a green-accent fill matching the rest of
// the Grassroots section. Submits to POST /api/grassroots and redirects
// to /grassroots/<id> on success.
//
// Photo uploads target the same `media` Supabase Storage bucket used by
// products/[id]/edit, with a per-user prefix `<user_id>/grassroots-...`
// so RLS on the bucket can scope writes by owner. Each upload is fired
// in parallel with progress reflected back into the photos array.
// ────────────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4 | 5 | 6
const TOTAL_STEPS = 6

interface FormState {
  listing_type: 'offering' | 'seeking' | null
  category:     string | null
  title:        string
  description:  string
  photos:       string[]
  rate:         string
  rate_type:    GrassrootsRateType
  trust_tokens_accepted: boolean
  location:     StructuredLocation
  availability: GrassrootsAvailability
  contact_preference: ContactPreference
  contact_value: string
}

const INITIAL: FormState = {
  listing_type: null,
  category: null,
  title: '',
  description: '',
  photos: [],
  rate: '',
  rate_type: 'hourly',
  trust_tokens_accepted: false,
  location: EMPTY_LOCATION,
  availability: 'flexible',
  contact_preference: 'platform',
  contact_value: '',
}

export default function GrassrootsNewPage() {
  const router = useRouter()
  const { currency } = useCurrency()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Currency starts at the user's preferred display currency from
  // CurrencyContext, then they can override on step 4.
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>(currency.code)

  // ── Step navigation ──────────────────────────────────────────────────
  const goNext = useCallback(() => setStep(s => (Math.min(TOTAL_STEPS, s + 1) as Step)), [])
  const goBack = useCallback(() => setStep(s => (Math.max(1, s - 1) as Step)), [])

  // ── Per-step validation ──────────────────────────────────────────────
  const canAdvance = useMemo(() => {
    switch (step) {
      case 1: return form.listing_type !== null
      case 2: return form.category !== null
      case 3: return form.title.trim().length > 0
      case 4:
        // Rate is optional when type is 'negotiable', otherwise must be a positive number
        if (form.rate_type === 'negotiable') return true
        return form.rate.trim().length > 0 && Number(form.rate) > 0
      case 5: return true // location + availability both have sensible defaults
      case 6:
        // Contact value required for everything except platform messages
        if (form.contact_preference === 'platform') return true
        return form.contact_value.trim().length > 0
      default: return false
    }
  }, [step, form])

  // ── Photo upload ─────────────────────────────────────────────────────
  // Uploads each file to the `media` Supabase Storage bucket (same bucket
  // the products edit page uses) under a per-user prefix. Returns the
  // public URLs which we append to the photos array. Cap at 6 photos —
  // grassroots cards only show the first one anyway and we don't need
  // a gallery beyond that.
  const handlePhotoSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to upload photos.')
        return
      }
      const remaining = 6 - form.photos.length
      const accepted = Array.from(files).slice(0, remaining)
      const uploaded: string[] = []
      for (let i = 0; i < accepted.length; i++) {
        // Client-side compression — mobile camera photos are 8–15 MB.
        // This direct-to-Supabase path doesn't hit Vercel's 4.5 MB
        // limit, but shrinking still helps with bandwidth, upload
        // time on mobile data, and storage costs. Also makes the 8 MB
        // client-side rejection below functionally dead for real
        // camera photos — they'll always land under it.
        const file = await compressImage(accepted[i], 2)
        // Reject anything still bigger than 8 MB after compression
        // (only really hits if compression fell back to the original,
        // e.g. HEIC on Chrome).
        if (file.size > 8 * 1024 * 1024) {
          setError(`${file.name} is over 8 MB — please choose a smaller file.`)
          continue
        }
        // Use .jpg extension since compression always outputs JPEG.
        // Falls back to the original extension if compression was
        // skipped (file already small enough, non-image, etc.).
        const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
        const path = `${user.id}/grassroots-${Date.now()}-${i}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('media')
          .upload(path, file, { upsert: false, contentType: file.type })
        if (upErr) {
          console.error('[grassroots upload]', upErr.message)
          setError(`Upload failed: ${upErr.message}`)
          continue
        }
        const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(path)
        uploaded.push(publicUrl)
      }
      if (uploaded.length > 0) {
        setForm(f => ({ ...f, photos: [...f.photos, ...uploaded] }))
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[grassroots upload] unhandled', msg)
      setError(`Upload error: ${msg}`)
    } finally {
      setUploading(false)
      // Reset the file input so the same file can be re-selected after a remove
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [form.photos.length])

  const removePhoto = useCallback((url: string) => {
    setForm(f => ({ ...f, photos: f.photos.filter(p => p !== url) }))
  }, [])

  // ── Submit ────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setError(null)
    setSubmitting(true)
    try {
      const body = {
        listing_type:         form.listing_type ?? 'offering',
        category:             form.category ?? '',
        title:                form.title.trim(),
        description:          form.description.trim() || null,
        photos:               form.photos,
        rate:                 form.rate_type === 'negotiable' ? null : (form.rate ? Number(form.rate) : null),
        rate_type:            form.rate_type,
        currency_code:        currencyCode,
        availability:         form.availability,
        country:              form.location.country,
        region:               form.location.region,
        city:                 form.location.city,
        latitude:             form.location.latitude,
        longitude:            form.location.longitude,
        location_label:       form.location.location_label,
        contact_preference:   form.contact_preference,
        contact_value:        form.contact_preference === 'platform' ? null : form.contact_value.trim() || null,
        trust_tokens_accepted: form.trust_tokens_accepted,
      }
      const res = await fetch('/api/grassroots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await res.json() as { id?: string; error?: string; success?: boolean }
      if (!res.ok || !d.success) {
        setError(d.error ?? `Could not save listing (HTTP ${res.status})`)
        setSubmitting(false)
        return
      }
      router.push(`/grassroots/${d.id}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(`Network error: ${msg}`)
      setSubmitting(false)
    }
  }, [form, currencyCode, router])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={pageStyle}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1.25rem 1.25rem 4rem' }}>
        {/* Back to Grassroots link */}
        <Link href="/grassroots" style={{
          color: GRASSROOTS_GREEN.primary,
          textDecoration: 'none',
          fontSize: 13,
          fontWeight: 600,
          display: 'inline-block',
          marginBottom: '1.25rem',
        }}>
          ← Back to Grassroots
        </Link>

        {/* Progress bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8' }}>
              Step {step} of {TOTAL_STEPS}
            </div>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              {STEP_LABELS[step - 1]}
            </div>
          </div>
          <div style={{ height: 6, background: 'rgba(34,197,94,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${(step / TOTAL_STEPS) * 100}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Step content */}
        <div style={{
          background: '#1e293b',
          border: '1px solid rgba(148,163,184,0.12)',
          borderRadius: 16,
          padding: '1.75rem 1.5rem',
        }}>
          {step === 1 && <Step1 form={form} setForm={setForm} />}
          {step === 2 && <Step2 form={form} setForm={setForm} />}
          {step === 3 && (
            <Step3
              form={form}
              setForm={setForm}
              uploading={uploading}
              onPhotoSelect={handlePhotoSelect}
              onPhotoRemove={removePhoto}
              fileInputRef={fileInputRef}
            />
          )}
          {step === 4 && (
            <Step4
              form={form}
              setForm={setForm}
              currencyCode={currencyCode}
              setCurrencyCode={setCurrencyCode}
            />
          )}
          {step === 5 && <Step5 form={form} setForm={setForm} />}
          {step === 6 && <Step6 form={form} setForm={setForm} />}

          {error && (
            <div style={{
              marginTop: 16,
              padding: '10px 14px',
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 10,
              color: '#f87171',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Nav buttons */}
        <div style={{
          display: 'flex',
          gap: 10,
          marginTop: '1.25rem',
          alignItems: 'center',
        }}>
          {step > 1 && (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              style={{
                padding: '12px 22px',
                background: 'transparent',
                border: '1px solid #334155',
                borderRadius: 10,
                color: '#94a3b8',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canAdvance}
              style={{
                padding: '12px 28px',
                background: canAdvance
                  ? `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`
                  : '#1e293b',
                border: 'none',
                borderRadius: 10,
                color: canAdvance ? '#0f172a' : '#475569',
                fontSize: 14,
                fontWeight: 800,
                cursor: canAdvance ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: canAdvance ? '0 4px 14px rgba(34,197,94,0.35)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canAdvance || submitting}
              style={{
                padding: '12px 28px',
                background: (canAdvance && !submitting)
                  ? `linear-gradient(135deg, ${GRASSROOTS_GREEN.primary}, ${GRASSROOTS_GREEN.primaryDim})`
                  : '#1e293b',
                border: 'none',
                borderRadius: 10,
                color: (canAdvance && !submitting) ? '#0f172a' : '#475569',
                fontSize: 14,
                fontWeight: 800,
                cursor: (canAdvance && !submitting) ? 'pointer' : 'not-allowed',
                fontFamily: 'inherit',
                boxShadow: (canAdvance && !submitting) ? '0 4px 14px rgba(34,197,94,0.35)' : 'none',
              }}
            >
              {submitting ? '⏳ Posting…' : '🌱 Post Listing'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Steps
// ────────────────────────────────────────────────────────────────────────────

const STEP_LABELS = [
  'What kind of listing?',
  'Pick a category',
  'Describe the work',
  'Set the rate',
  'Where & when?',
  'How to get in touch?',
]

interface StepProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
}

// ── Step 1: Offering vs Seeking ──────────────────────────────────────────
function Step1({ form, setForm }: StepProps) {
  return (
    <div>
      <h2 style={stepTitleStyle}>What kind of listing is this?</h2>
      <p style={stepHelpStyle}>
        Are you offering work to others, or looking for someone to do work for you?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {([
          { value: 'offering', emoji: '💪', title: 'I&apos;m offering work', sub: 'I have skills to offer the community' },
          { value: 'seeking',  emoji: '🔍', title: 'I&apos;m seeking work',  sub: 'I need help with something' },
        ] as const).map(opt => {
          const active = form.listing_type === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, listing_type: opt.value }))}
              style={{
                padding: '24px 16px',
                background: active ? GRASSROOTS_GREEN.tint : '#0f172a',
                border: `2px solid ${active ? GRASSROOTS_GREEN.primary : '#334155'}`,
                borderRadius: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: active ? GRASSROOTS_GREEN.primary : '#f1f5f9',
                textAlign: 'center',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>{opt.emoji}</div>
              <div
                style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}
                dangerouslySetInnerHTML={{ __html: opt.title }}
              />
              <div style={{ fontSize: 12, color: active ? GRASSROOTS_GREEN.primary : '#64748b', fontWeight: 500 }}>
                {opt.sub}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 2: Category grid ────────────────────────────────────────────────
function Step2({ form, setForm }: StepProps) {
  return (
    <div>
      <h2 style={stepTitleStyle}>Pick a category</h2>
      <p style={stepHelpStyle}>This helps the right people find your listing.</p>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: 10,
      }}>
        {GRASSROOTS_CATEGORIES.map(cat => {
          const active = form.category === cat.slug
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setForm(f => ({ ...f, category: cat.slug }))}
              style={{
                padding: '14px 10px',
                background: active ? GRASSROOTS_GREEN.tint : '#0f172a',
                border: `2px solid ${active ? GRASSROOTS_GREEN.primary : '#334155'}`,
                borderRadius: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: active ? GRASSROOTS_GREEN.primary : '#f1f5f9',
                textAlign: 'center',
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                minHeight: 100,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 26 }}>{cat.emoji}</span>
              <span style={{ lineHeight: 1.25 }}>{cat.label.split(' & ')[0]}</span>
              <span style={{ fontSize: 10, color: active ? GRASSROOTS_GREEN.primary : '#64748b', fontWeight: 400, lineHeight: 1.3 }}>
                {cat.blurb}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 3: Details + photo upload ───────────────────────────────────────
interface Step3Props extends StepProps {
  uploading: boolean
  onPhotoSelect: (files: FileList | null) => void
  onPhotoRemove: (url: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
}

function Step3({ form, setForm, uploading, onPhotoSelect, onPhotoRemove, fileInputRef }: Step3Props) {
  const cat = form.category ? GRASSROOTS_CATEGORIES_BY_SLUG[form.category] : null
  const photosFull = form.photos.length >= 6
  return (
    <div>
      <h2 style={stepTitleStyle}>Describe the work</h2>
      <p style={stepHelpStyle}>
        {cat && <>Category: <span style={{ color: GRASSROOTS_GREEN.primary, fontWeight: 700 }}>{cat.emoji} {cat.label}</span>. </>}
        Be specific — clear titles get more responses.
      </p>

      <label style={fieldLabelStyle}>Title *</label>
      <input
        type="text"
        value={form.title}
        onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        placeholder={form.listing_type === 'seeking' ? 'e.g. Need help moving a sofa on Saturday' : 'e.g. Experienced fence builder, weekend availability'}
        maxLength={120}
        style={inputStyle}
      />
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4, marginBottom: 16 }}>
        {form.title.length}/120
      </div>

      <label style={fieldLabelStyle}>Description</label>
      <textarea
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        placeholder="Add more details — what's involved, equipment provided, experience needed, anything that helps the right person respond."
        rows={5}
        maxLength={2000}
        style={{ ...inputStyle, resize: 'vertical', minHeight: 120, fontFamily: 'inherit' }}
      />
      <div style={{ fontSize: 11, color: '#475569', marginTop: 4, marginBottom: 16 }}>
        {form.description.length}/2000
      </div>

      <label style={fieldLabelStyle}>Photos (optional, up to 6)</label>
      {form.photos.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 8,
          marginBottom: 12,
        }}>
          {form.photos.map(url => (
            <div key={url} style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => onPhotoRemove(url)}
                aria-label="Remove photo"
                style={{
                  position: 'absolute',
                  top: 4, right: 4,
                  width: 22, height: 22,
                  borderRadius: '50%',
                  background: 'rgba(15,23,42,0.85)',
                  border: '1px solid rgba(248,113,113,0.4)',
                  color: '#f87171',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={uploading || photosFull}
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: '100%',
          padding: '14px',
          background: 'transparent',
          border: `1.5px dashed ${photosFull ? '#334155' : GRASSROOTS_GREEN.borderSoft}`,
          borderRadius: 10,
          color: photosFull ? '#475569' : GRASSROOTS_GREEN.primary,
          fontSize: 13,
          fontWeight: 600,
          cursor: (uploading || photosFull) ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {uploading
          ? '⏳ Uploading…'
          : photosFull
          ? 'Maximum 6 photos reached'
          : `📷 ${form.photos.length === 0 ? 'Add photos' : 'Add more photos'}`}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={e => onPhotoSelect(e.target.files)}
        style={{ display: 'none' }}
      />
    </div>
  )
}

// ── Step 4: Rate ─────────────────────────────────────────────────────────
interface Step4Props extends StepProps {
  currencyCode: CurrencyCode
  setCurrencyCode: (c: CurrencyCode) => void
}

function Step4({ form, setForm, currencyCode, setCurrencyCode }: Step4Props) {
  const isNegotiable = form.rate_type === 'negotiable'
  return (
    <div>
      <h2 style={stepTitleStyle}>Set the rate</h2>
      <p style={stepHelpStyle}>What does the work cost? Negotiable is fine if you&apos;d rather discuss.</p>

      <label style={fieldLabelStyle}>Rate type</label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: 8,
        marginBottom: 18,
      }}>
        {RATE_TYPE_OPTIONS.map(opt => {
          const active = form.rate_type === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, rate_type: opt.value }))}
              style={{
                padding: '12px 8px',
                background: active ? GRASSROOTS_GREEN.tint : '#0f172a',
                border: `1.5px solid ${active ? GRASSROOTS_GREEN.primary : '#334155'}`,
                borderRadius: 10,
                color: active ? GRASSROOTS_GREEN.primary : '#94a3b8',
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>

      {!isNegotiable && (
        <>
          <label style={fieldLabelStyle}>Amount</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
            <select
              value={currencyCode}
              onChange={e => setCurrencyCode(e.target.value as CurrencyCode)}
              style={{
                ...inputStyle,
                width: 'auto',
                paddingRight: 32,
                cursor: 'pointer',
              }}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.rate}
              onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
              placeholder="0.00"
              style={{ ...inputStyle, flex: 1 }}
            />
          </div>
        </>
      )}

      {/* ── Trust tokens as PRIMARY payment method ─────────────────────
          Promoted above the currency picker in the visual hierarchy so
          users see ₮ first. The card has a "Recommended" pill when
          off (to nudge opt-in) and a "✓ Active" pill when on. Same
          colour palette as the rest of the ₮ UI (#38bdf8 cyan). */}
      <div style={{ marginTop: 8 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}>
          <label style={fieldLabelStyle}>Primary payment</label>
          <span style={{
            fontSize: 10,
            color: form.trust_tokens_accepted ? '#38bdf8' : '#64748b',
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}>
            {form.trust_tokens_accepted ? '✓ Active' : 'Recommended'}
          </span>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            padding: '16px 18px',
            background: form.trust_tokens_accepted ? 'rgba(56,189,248,0.1)' : '#0f172a',
            border: `2px solid ${form.trust_tokens_accepted ? '#38bdf8' : 'rgba(56,189,248,0.25)'}`,
            borderRadius: 14,
            cursor: 'pointer',
            boxShadow: form.trust_tokens_accepted ? '0 0 0 3px rgba(56,189,248,0.08)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          <input
            type="checkbox"
            checked={form.trust_tokens_accepted}
            onChange={e => setForm(f => ({ ...f, trust_tokens_accepted: e.target.checked }))}
            style={{ width: 20, height: 20, accentColor: '#38bdf8', marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 15, fontWeight: 800,
              color: form.trust_tokens_accepted ? '#38bdf8' : '#f1f5f9',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ fontSize: 18 }}>₮</span> Accept FreeTrust Trust tokens
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.55 }}>
              Trust is the primary payment rail on Grassroots — listings that
              accept ₮ get boosted in search and tagged &ldquo;Pay with Trust&rdquo;
              on every card. Clients can still pay in {currencyCode} as
              full or partial top-up, so you never lose a sale by opting in.
            </div>
          </div>
        </label>
      </div>
    </div>
  )
}

// ── Step 5: Location + availability ──────────────────────────────────────
function Step5({ form, setForm }: StepProps) {
  return (
    <div>
      <h2 style={stepTitleStyle}>Where & when?</h2>
      <p style={stepHelpStyle}>Adding a location helps people find you nearby.</p>

      <label style={fieldLabelStyle}>📍 Location</label>
      <LocationPicker
        value={form.location}
        onChange={loc => setForm(f => ({ ...f, location: loc }))}
        placeholder="e.g. London, UK"
      />
      <div style={{ marginBottom: 18 }} />

      <label style={fieldLabelStyle}>🗓 Availability</label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 8,
      }}>
        {AVAILABILITY_OPTIONS.map(opt => {
          const active = form.availability === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, availability: opt.value }))}
              style={{
                padding: '12px 8px',
                background: active ? opt.bg : '#0f172a',
                border: `1.5px solid ${active ? opt.border : '#334155'}`,
                borderRadius: 10,
                color: active ? opt.color : '#94a3b8',
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 6: Contact preference ───────────────────────────────────────────
function Step6({ form, setForm }: StepProps) {
  const selected = CONTACT_PREFERENCE_OPTIONS.find(o => o.value === form.contact_preference)
  return (
    <div>
      <h2 style={stepTitleStyle}>How should people contact you?</h2>
      <p style={stepHelpStyle}>Pick the channel you check most often.</p>

      <label style={fieldLabelStyle}>Contact via</label>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 8,
        marginBottom: 18,
      }}>
        {CONTACT_PREFERENCE_OPTIONS.map(opt => {
          const active = form.contact_preference === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm(f => ({ ...f, contact_preference: opt.value, contact_value: '' }))}
              style={{
                padding: '14px 10px',
                background: active ? GRASSROOTS_GREEN.tint : '#0f172a',
                border: `1.5px solid ${active ? GRASSROOTS_GREEN.primary : '#334155'}`,
                borderRadius: 10,
                color: active ? GRASSROOTS_GREEN.primary : '#94a3b8',
                fontWeight: active ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 22 }}>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>

      {form.contact_preference !== 'platform' && (
        <>
          <label style={fieldLabelStyle}>
            {form.contact_preference === 'email' ? 'Email address' : 'Phone number'} *
          </label>
          <input
            type={form.contact_preference === 'email' ? 'email' : 'tel'}
            inputMode={form.contact_preference === 'email' ? 'email' : 'tel'}
            value={form.contact_value}
            onChange={e => setForm(f => ({ ...f, contact_value: e.target.value }))}
            placeholder={selected?.placeholder ?? ''}
            style={inputStyle}
            autoComplete="off"
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
            {form.contact_preference === 'whatsapp' && 'Include the country code (e.g. +353). Clients tap a button to open WhatsApp.'}
            {form.contact_preference === 'phone' && 'Include the country code so people can call from anywhere.'}
            {form.contact_preference === 'email' && 'Clients tap a button to open their mail app.'}
          </div>
        </>
      )}

      {form.contact_preference === 'platform' && (
        <div style={{
          padding: '14px 16px',
          background: 'rgba(56,189,248,0.06)',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 10,
          fontSize: 13,
          color: '#94a3b8',
          lineHeight: 1.5,
        }}>
          💬 Clients will message you through FreeTrust. You&apos;ll get notifications in your inbox.
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Shared styles
// ────────────────────────────────────────────────────────────────────────────
const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#f1f5f9',
  fontFamily: 'system-ui, sans-serif',
  paddingTop: 64,
  paddingBottom: 80,
}

const stepTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 800,
  margin: '0 0 8px',
  color: '#f1f5f9',
}

const stepHelpStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#94a3b8',
  margin: '0 0 18px',
  lineHeight: 1.5,
}

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 6,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0f172a',
  border: '1.5px solid #334155',
  borderRadius: 10,
  padding: '11px 14px',
  fontSize: 14,
  color: '#f1f5f9',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}
