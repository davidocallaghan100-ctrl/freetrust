'use client'
import React, { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { compressImage } from '@/lib/image-compression'

const SKILLS = ['Design','Development','Marketing','Writing','Sales','Finance','Operations','Photography','Video','Music','Coaching','Legal','Consulting','Education','Data','AI / Automation','Sustainability','Community','Healthcare','Trades']
const CATEGORIES = ['Tech & Software','Design & Creative','Marketing & Growth','Finance & Business','Legal & Compliance','Education & Learning','Health & Wellness','Trades & Services','Food & Catering','Arts & Culture','Community & Charity','Events & Entertainment']
// Hobbies presets — shown as tappable chips on the hobbies step.
// Users can also type free-text entries via the custom input below the
// grid. Both get stored in profiles.hobbies (text[]).
const HOBBIES = [
  { id: 'Music',            icon: '🎵' },
  { id: 'Art',              icon: '🎨' },
  { id: 'Fitness',          icon: '🏃' },
  { id: 'Reading',          icon: '📚' },
  { id: 'Cooking',          icon: '🍳' },
  { id: 'Gardening',        icon: '🌱' },
  { id: 'Travel',           icon: '✈️' },
  { id: 'Gaming',           icon: '🎮' },
  { id: 'Animals',          icon: '🐾' },
  { id: 'Tech',             icon: '💻' },
  { id: 'Theatre',          icon: '🎭' },
  { id: 'Photography',      icon: '📸' },
  { id: 'Outdoors',         icon: '🏄' },
  { id: 'Wellness',         icon: '🧘' },
  { id: 'Volunteering',     icon: '🤝' },
  { id: 'Entrepreneurship', icon: '💼' },
]
const PURPOSES = [
  { id: 'buying', label: 'Buying', icon: '🛍️', desc: 'Find quality products and services' },
  { id: 'selling', label: 'Selling', icon: '💼', desc: 'Sell your skills, products or services' },
  { id: 'both', label: 'Both', icon: '🔄', desc: 'Buy and sell on the platform' },
  { id: 'networking', label: 'Networking', icon: '🤝', desc: 'Connect with like-minded people' },
  { id: 'learning', label: 'Learning', icon: '📚', desc: 'Grow your skills and knowledge' },
]
const FIRST_ACTIONS = [
  { id: 'listing', label: 'Create a listing', icon: '✨', href: '/seller/gigs/create' },
  { id: 'browse', label: 'Browse the marketplace', icon: '🛒', href: '/services' },
  { id: 'community', label: 'Join a community', icon: '👥', href: '/community' },
  { id: 'follow', label: 'Follow members', icon: '⭐', href: '/browse' },
]

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '2rem' }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{ flex: 1, height: 3, borderRadius: 999, background: i < step ? '#38bdf8' : 'rgba(148,163,184,0.15)', transition: 'background 0.3s' }} />
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [accountType, setAccountType] = useState<'individual' | 'business'>('individual')
  // Split display name into first + last so we can store to
  // profiles.first_name / profiles.last_name. The full_name column
  // gets auto-synced by the trigger in 20260412_profiles_first_last_name.sql.
  // Both are REQUIRED before the user can leave step 2.
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  // Cover photo is OPTIONAL — users can skip it and continue. Uploaded
  // via /api/upload/media (same pattern as products/gigs) so the file
  // goes through the server-side MIME sniffing + HEIC-safe upload path
  // instead of direct client-to-Supabase-storage like the avatar does.
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([])
  // Hobbies step — preset chips + free-text custom entries.
  // Optional; the "Skip" button on the step bypasses it.
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([])
  const [customHobby, setCustomHobby] = useState('')
  const [trustAwarded, setTrustAwarded] = useState(0)

  const toggleArr = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    set(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const addCustomHobby = () => {
    const t = customHobby.trim()
    if (!t) return
    // De-dupe case-insensitively so "music" and "Music" don't both show
    const alreadyPresent = selectedHobbies.some(h => h.toLowerCase() === t.toLowerCase())
    if (!alreadyPresent) {
      setSelectedHobbies(prev => [...prev, t])
    }
    setCustomHobby('')
  }

  // Total steps bumped 5 → 6 to make room for the hobbies step at
  // position 4. Old step 4 (First Action) is now 5 and the welcome
  // celebration is 6.
  const TOTAL_STEPS = 6
  const next = () => setStep(s => Math.min(s + 1, TOTAL_STEPS))
  const back = () => setStep(s => Math.max(s - 1, 1))

  const handlePhotoUpload = async (rawFile: File) => {
    setPhotoUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Avatars get an aggressive 1 MB cap — they're displayed at
      // ≤128 px so anything bigger is pure waste. Also fixes HTTP 413
      // on mobile camera selfies (8–15 MB originals).
      const file = await compressImage(rawFile, 1)
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        setAvatarUrl(data.publicUrl)
        await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
      }
    } catch { /* silent */ }
    finally { setPhotoUploading(false) }
  }

  // Cover photo upload — goes through /api/upload/media so it benefits
  // from the HEIC-safe MIME sniffing and the synthetic-path sanitiser
  // landed in 097ecd2. Does NOT block onboarding progression: if the
  // upload fails we show an inline error but the Continue button stays
  // enabled.
  const handleCoverUpload = async (rawFile: File) => {
    setCoverUploading(true)
    setCoverError(null)
    try {
      // Client-side compression — mobile camera photos are 8–15 MB and
      // exceed Vercel's 4.5 MB body limit (HTTP 413). Shrinks to ~2 MB
      // before the request is built. Falls back to the original file
      // on any failure (HEIC without decoder, canvas error, etc.).
      const file = await compressImage(rawFile, 2)
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', 'cover')
      const res = await fetch('/api/upload/media', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({} as { url?: string; error?: string }))
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Upload failed (HTTP ${res.status})`)
      }
      setCoverUrl(data.url)
      // Persist immediately so the cover survives even if the user bails
      // out of onboarding before hitting "Continue".
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { error: updErr } = await supabase
          .from('profiles')
          .update({ cover_url: data.url })
          .eq('id', user.id)
        if (updErr) {
          console.error('[onboarding] cover_url persist error:', updErr)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cover upload failed'
      console.error('[onboarding] cover upload:', msg)
      setCoverError(msg)
    } finally {
      setCoverUploading(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  // `firstActionHref` is unused inside `complete` — the welcome step
  // renders its own first-action buttons. Kept in the signature for
  // call-site compatibility.
  const complete = async (_firstActionHref: string) => {
    setSaving(true)
    try {
      // full_name is derived from first_name + last_name here so the
      // profile has a full_name immediately even if the DB trigger
      // that auto-syncs it hasn't run yet (trigger is installed by
      // 20260412_profiles_first_last_name.sql — belt-and-braces).
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: accountType,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          bio,
          location,
          skills: selectedSkills,
          interests: selectedInterests,
          purpose: selectedPurposes,
          hobbies: selectedHobbies,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
        }),
      })
      const json = await res.json()
      setTrustAwarded(json.trust_awarded ?? 0)
      setStep(TOTAL_STEPS)
    } catch {
      setStep(TOTAL_STEPS)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem', fontFamily: 'system-ui' }}>
      <style>{`
        .ob-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.12); border-radius: 20px; padding: 2.5rem; width: 100%; max-width: 540px; }
        .ob-type-btn { flex: 1; padding: 1.25rem; border-radius: 14px; border: 2px solid rgba(148,163,184,0.15); background: transparent; cursor: pointer; text-align: center; transition: all 0.15s; color: #f1f5f9; }
        .ob-type-btn.active { border-color: #38bdf8; background: rgba(56,189,248,0.08); }
        .ob-type-btn:hover { border-color: rgba(56,189,248,0.4); }
        .ob-chip { padding: 0.4rem 0.85rem; border-radius: 999px; font-size: 0.8rem; cursor: pointer; border: 1px solid rgba(148,163,184,0.2); background: transparent; color: #94a3b8; transition: all 0.12s; }
        .ob-chip.active { background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.35); color: #38bdf8; font-weight: 600; }
        .ob-chip:hover { border-color: rgba(56,189,248,0.3); color: #cbd5e1; }
        .ob-input { width: 100%; background: #0f172a; border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.92rem; color: #f1f5f9; outline: none; box-sizing: border-box; font-family: inherit; }
        .ob-input:focus { border-color: rgba(56,189,248,0.4); }
        .ob-label { font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.06em; display: block; }
        .ob-btn-primary { width: 100%; padding: 0.85rem; background: linear-gradient(135deg,#38bdf8,#0284c7); border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; color: #0f172a; cursor: pointer; transition: opacity 0.15s; font-family: inherit; }
        .ob-btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .ob-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .ob-btn-secondary { background: transparent; border: 1px solid rgba(148,163,184,0.2); border-radius: 10px; padding: 0.75rem 1.5rem; font-size: 0.88rem; color: #64748b; cursor: pointer; font-family: inherit; }
        .ob-purpose-btn { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.9rem 1rem; border-radius: 12px; border: 1px solid rgba(148,163,184,0.15); background: transparent; cursor: pointer; text-align: left; transition: all 0.12s; font-family: inherit; }
        .ob-purpose-btn.active { border-color: #38bdf8; background: rgba(56,189,248,0.08); }
        .ob-purpose-btn:hover { border-color: rgba(56,189,248,0.3); }
        .ob-action-btn { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.9rem 1rem; border-radius: 12px; border: 1px solid rgba(148,163,184,0.15); background: transparent; cursor: pointer; text-align: left; transition: all 0.12s; color: #f1f5f9; font-family: inherit; }
        .ob-action-btn:hover { border-color: rgba(56,189,248,0.35); background: rgba(56,189,248,0.05); }
        .ob-avatar-ring { width: 88px; height: 88px; border-radius: 50%; border: 2px dashed rgba(56,189,248,0.35); display: flex; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; position: relative; transition: border-color 0.2s; background: rgba(56,189,248,0.05); flex-shrink: 0; }
        .ob-avatar-ring:hover { border-color: #38bdf8; }
        @media (max-width: 600px) { .ob-card { padding: 1.75rem 1.25rem; } }
      `}</style>

      <div className="ob-card">
        <ProgressBar step={step} total={TOTAL_STEPS} />

        {/* STEP 1 — Account Type */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👋</div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.4rem' }}>Welcome to FreeTrust</h1>
              <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>Let&apos;s get you set up. How are you joining?</p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <button className={`ob-type-btn${accountType === 'individual' ? ' active' : ''}`} onClick={() => setAccountType('individual')}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Individual</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Freelancer, creator, professional</div>
              </button>
              <button className={`ob-type-btn${accountType === 'business' ? ' active' : ''}`} onClick={() => setAccountType('business')}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏢</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>Business</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>Company, agency, organisation</div>
              </button>
            </div>
            <button className="ob-btn-primary" onClick={next}>Continue →</button>
          </div>
        )}

        {/* STEP 2 — Profile Setup */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.3rem' }}>Set up your profile</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>This is how others will find and know you</p>
            </div>

            {/* Photo upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div
                className="ob-avatar-ring"
                onClick={() => photoInputRef.current?.click()}
                title="Upload profile photo"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.6rem' }}>{photoUploading ? '⏳' : '📷'}</div>
                  </div>
                )}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.82rem', color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '0.35rem', display: 'block' }}
                >
                  {photoUploading ? 'Uploading…' : avatarUrl ? '✓ Change photo' : 'Upload photo'}
                </button>
                <div style={{ fontSize: '0.72rem', color: avatarUrl ? '#34d399' : '#f87171', fontWeight: 600 }}>
                  {avatarUrl ? '✓ Photo set' : '* Required — helps build trust'}
                </div>
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }}
              />
            </div>

            {/* Cover photo upload (optional — does NOT gate Continue) */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div
                onClick={() => !coverUploading && coverInputRef.current?.click()}
                style={{
                  position: 'relative',
                  height: 110,
                  borderRadius: 12,
                  border: '2px dashed rgba(56,189,248,0.25)',
                  background: coverUrl
                    ? 'transparent'
                    : 'linear-gradient(135deg, rgba(56,189,248,0.06), rgba(129,140,248,0.05))',
                  cursor: coverUploading ? 'wait' : 'pointer',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.15s',
                }}
                title="Upload cover photo (optional)"
              >
                {coverUrl ? (
                  <>
                    <img
                      src={coverUrl}
                      alt="Cover"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, transparent 60%, rgba(15,23,42,0.7))',
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'flex-end',
                      padding: '0.5rem 0.75rem',
                    }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#f1f5f9' }}>
                        ✓ Change cover
                      </span>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', color: '#64748b' }}>
                    <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
                      {coverUploading ? '⏳' : '🖼️'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
                      {coverUploading ? 'Uploading…' : 'Add cover photo'}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: '0.15rem' }}>
                      Optional — can skip and add later
                    </div>
                  </div>
                )}
              </div>
              {coverError && (
                <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: '0.35rem' }}>
                  ⚠️ {coverError}
                </div>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverUpload(f) }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {/* First + Last name — both REQUIRED. The old single
                  "Display Name" field was ambiguous about whether users
                  should enter a business or personal name and produced
                  profiles with no parseable first/last for the name
                  directory, messaging @mentions, and trust badge
                  salutations. Splitting forces a consistent shape. */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="ob-label">First name *</label>
                  <input
                    className="ob-input"
                    value={firstName}
                    onChange={e => { setFirstName(e.target.value); setNameError(null) }}
                    placeholder="David"
                    autoComplete="given-name"
                    autoCapitalize="words"
                  />
                </div>
                <div>
                  <label className="ob-label">Last name *</label>
                  <input
                    className="ob-input"
                    value={lastName}
                    onChange={e => { setLastName(e.target.value); setNameError(null) }}
                    placeholder="O&rsquo;Callaghan"
                    autoComplete="family-name"
                    autoCapitalize="words"
                  />
                </div>
              </div>
              {nameError && (
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '0.55rem 0.8rem', fontSize: '0.78rem', color: '#fca5a5' }}>
                  ⚠️ {nameError}
                </div>
              )}
              <div>
                <label className="ob-label">Bio</label>
                <textarea className="ob-input" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the community a bit about yourself…" rows={3} style={{ resize: 'vertical' }} maxLength={300} />
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem', textAlign: 'right' }}>{bio.length}/300</div>
              </div>
              <div>
                <label className="ob-label">Location</label>
                <input className="ob-input" value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" />
              </div>
              <div>
                <label className="ob-label">Skills (pick any that apply)</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.25rem' }}>
                  {SKILLS.map(s => (
                    <button key={s} className={`ob-chip${selectedSkills.includes(s) ? ' active' : ''}`} onClick={() => toggleArr(selectedSkills, setSelectedSkills, s)}>{s}</button>
                  ))}
                </div>
              </div>
            </div>

            {!avatarUrl && firstName.trim() && lastName.trim() && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '0.6rem 0.85rem', fontSize: '0.8rem', color: '#fca5a5', marginBottom: '0.75rem' }}>
                📷 Please upload a profile photo — it builds trust with other members.
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="ob-btn-secondary" onClick={back}>Back</button>
              <button
                className="ob-btn-primary"
                onClick={() => {
                  // Hard gate — both names must be non-empty before we
                  // can move past this step. Show an inline banner if
                  // either is blank so the reason is obvious on mobile
                  // where the disabled button can look like dead UI.
                  if (!firstName.trim()) return setNameError('Please enter your first name.')
                  if (!lastName.trim())  return setNameError('Please enter your last name.')
                  if (!avatarUrl)        return setNameError('Please upload a profile photo to continue.')
                  setNameError(null)
                  next()
                }}
                disabled={!firstName.trim() || !lastName.trim() || !avatarUrl || photoUploading}
              >
                {photoUploading ? 'Uploading…' : 'Continue →'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Interests */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.3rem' }}>What are you here for?</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>We&apos;ll personalise your experience based on your answers</p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="ob-label">I&apos;m here to… (select all that apply)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {PURPOSES.map(p => (
                  <button key={p.id} className={`ob-purpose-btn${selectedPurposes.includes(p.id) ? ' active' : ''}`} onClick={() => toggleArr(selectedPurposes, setSelectedPurposes, p.id)}>
                    <span style={{ fontSize: '1.4rem' }}>{p.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f1f5f9' }}>{p.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{p.desc}</div>
                    </div>
                    {selectedPurposes.includes(p.id) && <span style={{ marginLeft: 'auto', color: '#38bdf8', fontSize: '1.1rem' }}>✓</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.75rem' }}>
              <label className="ob-label">Interested in (categories)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
                {CATEGORIES.map(c => (
                  <button key={c} className={`ob-chip${selectedInterests.includes(c) ? ' active' : ''}`} onClick={() => toggleArr(selectedInterests, setSelectedInterests, c)}>{c}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="ob-btn-secondary" onClick={back}>Back</button>
              <button className="ob-btn-primary" onClick={next}>Continue →</button>
            </div>
          </div>
        )}

        {/* STEP 4 — Hobbies (optional) */}
        {step === 4 && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.3rem' }}>What are your hobbies?</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Pick a few — they&apos;ll show on your profile so people with shared interests can find you. Optional.</p>
            </div>

            {/* Preset hobby chips — tap to toggle */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '1.25rem' }}>
              {HOBBIES.map(h => {
                const active = selectedHobbies.includes(h.id)
                return (
                  <button
                    key={h.id}
                    type="button"
                    className={`ob-chip${active ? ' active' : ''}`}
                    onClick={() => toggleArr(selectedHobbies, setSelectedHobbies, h.id)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <span>{h.icon}</span>
                    <span>{h.id}</span>
                  </button>
                )
              })}
            </div>

            {/* Custom free-text input */}
            <div style={{ marginBottom: '1rem' }}>
              <label className="ob-label">Add your own</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  className="ob-input"
                  value={customHobby}
                  onChange={e => setCustomHobby(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomHobby()
                    }
                  }}
                  placeholder="e.g. Beekeeping, Jiu-Jitsu, Chess…"
                  maxLength={40}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  onClick={addCustomHobby}
                  disabled={!customHobby.trim()}
                  style={{
                    background: customHobby.trim() ? 'rgba(56,189,248,0.12)' : 'transparent',
                    border: '1px solid rgba(56,189,248,0.3)',
                    borderRadius: 10,
                    padding: '0 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: customHobby.trim() ? '#38bdf8' : '#475569',
                    cursor: customHobby.trim() ? 'pointer' : 'not-allowed',
                    fontFamily: 'inherit',
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            {/* Custom hobbies already added — shown as removable chips */}
            {selectedHobbies.filter(h => !HOBBIES.some(preset => preset.id === h)).length > 0 && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="ob-label">Your custom hobbies</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.35rem' }}>
                  {selectedHobbies
                    .filter(h => !HOBBIES.some(preset => preset.id === h))
                    .map(h => (
                      <button
                        key={h}
                        type="button"
                        className="ob-chip active"
                        onClick={() => setSelectedHobbies(prev => prev.filter(x => x !== h))}
                        title="Remove"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <span>{h}</span>
                        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>✕</span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="ob-btn-secondary" onClick={back}>Back</button>
              <button
                className="ob-btn-secondary"
                onClick={() => { setSelectedHobbies([]); setCustomHobby(''); next() }}
                style={{ flex: 1 }}
              >
                Skip
              </button>
              <button className="ob-btn-primary" onClick={next} style={{ flex: 1 }}>
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — First Action */}
        {step === 5 && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.3rem' }}>What do you want to do first?</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Choose where to go after setup — you can change this any time</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
              {FIRST_ACTIONS.map(a => (
                <button key={a.id} className="ob-action-btn" onClick={() => complete(a.href)} disabled={saving}>
                  <span style={{ fontSize: '1.5rem' }}>{a.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{a.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#38bdf8', fontSize: '0.8rem' }}>{saving ? '…' : '→'}</span>
                </button>
              ))}
            </div>

            <button className="ob-btn-secondary" onClick={back} style={{ width: '100%' }}>Back</button>
          </div>
        )}

        {/* STEP 6 — Welcome / Celebration */}
        {step === 6 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.5rem' }}>You&apos;re all set!</h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 1.5rem' }}>Welcome to the FreeTrust community.</p>

            {/* Trust bonus */}
            <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(129,140,248,0.08))', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.25rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8' }}>₮{trustAwarded > 0 ? trustAwarded : 25}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', marginTop: '0.25rem' }}>Trust Bonus Awarded! ✅</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>Added to your wallet as a founding member</div>
            </div>

            {/* Founding badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '0.6rem 1.2rem', marginBottom: '1.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🏅</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>Founding Member ✅</div>
                <div style={{ fontSize: '0.72rem', color: '#92400e' }}>Badge awarded to your profile</div>
              </div>
            </div>

            {/* First action buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
              {FIRST_ACTIONS.map(a => (
                <button key={a.id} className="ob-action-btn" onClick={() => { window.location.href = a.href }}>
                  <span style={{ fontSize: '1.3rem' }}>{a.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{a.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#38bdf8', fontSize: '0.8rem' }}>→</span>
                </button>
              ))}
            </div>

            <button
              className="ob-btn-primary"
              onClick={() => { window.location.href = '/dashboard' }}
            >
              Go to my dashboard →
            </button>

            <button onClick={() => router.push('/feed')} style={{ marginTop: '0.75rem', width: '100%', background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'inherit' }}>
              Go to feed instead
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
