'use client'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SKILLS = ['Design','Development','Marketing','Writing','Sales','Finance','Operations','Photography','Video','Music','Coaching','Legal','Consulting','Education','Data','AI / Automation','Sustainability','Community','Healthcare','Trades']
const CATEGORIES = ['Tech & Software','Design & Creative','Marketing & Growth','Finance & Business','Legal & Compliance','Education & Learning','Health & Wellness','Trades & Services','Food & Catering','Arts & Culture','Community & Charity','Events & Entertainment']
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
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Form state
  const [accountType, setAccountType] = useState<'individual' | 'business'>('individual')
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [location, setLocation] = useState('')
  const [selectedSkills, setSelectedSkills] = useState<string[]>([])
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([])
  const [trustAwarded, setTrustAwarded] = useState(0)

  const toggleArr = (arr: string[], set: React.Dispatch<React.SetStateAction<string[]>>, val: string) => {
    set(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])
  }

  const next = () => setStep(s => Math.min(s + 1, 5))
  const back = () => setStep(s => Math.max(s - 1, 1))

  const complete = async (firstActionHref: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_type: accountType,
          full_name: displayName,
          bio,
          location,
          skills: selectedSkills,
          interests: selectedInterests,
          purpose: selectedPurposes,
        }),
      })
      const json = await res.json()
      setTrustAwarded(json.trust_awarded ?? 0)
      setStep(5)
    } catch {
      setStep(5)
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
        .ob-input { width: 100%; background: #0f172a; border: 1px solid rgba(56,189,248,0.15); border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.92rem; color: #f1f5f9; outline: none; box-sizing: border-box; }
        .ob-input:focus { border-color: rgba(56,189,248,0.4); }
        .ob-label { font-size: 0.8rem; font-weight: 600; color: #64748b; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.06em; display: block; }
        .ob-btn-primary { width: 100%; padding: 0.85rem; background: linear-gradient(135deg,#38bdf8,#0284c7); border: none; border-radius: 10px; font-size: 0.95rem; font-weight: 700; color: #0f172a; cursor: pointer; transition: opacity 0.15s; }
        .ob-btn-primary:hover { opacity: 0.9; }
        .ob-btn-secondary { background: transparent; border: 1px solid rgba(148,163,184,0.2); border-radius: 10px; padding: 0.75rem 1.5rem; font-size: 0.88rem; color: #64748b; cursor: pointer; }
        .ob-purpose-btn { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.9rem 1rem; border-radius: 12px; border: 1px solid rgba(148,163,184,0.15); background: transparent; cursor: pointer; text-align: left; transition: all 0.12s; }
        .ob-purpose-btn.active { border-color: #38bdf8; background: rgba(56,189,248,0.08); }
        .ob-purpose-btn:hover { border-color: rgba(56,189,248,0.3); }
        .ob-action-btn { display: flex; align-items: center; gap: 0.75rem; width: 100%; padding: 0.9rem 1rem; border-radius: 12px; border: 1px solid rgba(148,163,184,0.15); background: transparent; cursor: pointer; text-align: left; transition: all 0.12s; color: #f1f5f9; }
        .ob-action-btn:hover { border-color: rgba(56,189,248,0.35); background: rgba(56,189,248,0.05); }
        @media (max-width: 600px) { .ob-card { padding: 1.75rem 1.25rem; } }
      `}</style>

      <div className="ob-card">
        <ProgressBar step={step} total={5} />

        {/* STEP 1 — Account Type */}
        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👋</div>
              <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.4rem' }}>Welcome to FreeTrust</h1>
              <p style={{ color: '#64748b', fontSize: '0.92rem', margin: 0 }}>Let's get you set up. How are you joining?</p>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label className="ob-label">Display Name *</label>
                <input className="ob-input" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name or business name" />
              </div>
              <div>
                <label className="ob-label">Bio</label>
                <textarea className="ob-input" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell the community a bit about yourself…" rows={3} style={{ resize: 'vertical', fontFamily: 'inherit' }} maxLength={300} />
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

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="ob-btn-secondary" onClick={back}>Back</button>
              <button className="ob-btn-primary" onClick={next} disabled={!displayName.trim()}>Continue →</button>
            </div>
          </div>
        )}

        {/* STEP 3 — Interests */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.3rem' }}>What are you here for?</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>We'll personalise your experience based on your answers</p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="ob-label">I'm here to… (select all that apply)</label>
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

        {/* STEP 4 — First Action */}
        {step === 4 && (
          <div>
            <div style={{ marginBottom: '1.75rem' }}>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.3rem' }}>What do you want to do first?</h2>
              <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Choose where to go after setup — you can change this any time</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.75rem' }}>
              {FIRST_ACTIONS.map(a => (
                <button key={a.id} className="ob-action-btn" onClick={() => complete(a.href)}>
                  <span style={{ fontSize: '1.5rem' }}>{a.icon}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{a.label}</span>
                  <span style={{ marginLeft: 'auto', color: '#38bdf8', fontSize: '0.8rem' }}>→</span>
                </button>
              ))}
            </div>

            <button className="ob-btn-secondary" onClick={back} style={{ width: '100%' }}>Back</button>
          </div>
        )}

        {/* STEP 5 — Welcome / Celebration */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.5rem' }}>You're all set!</h2>
            <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '0 0 1.5rem' }}>Welcome to the FreeTrust community.</p>

            {/* Trust bonus */}
            <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.1),rgba(129,140,248,0.08))', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8' }}>₮25</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9', marginTop: '0.25rem' }}>Trust Bonus Awarded!</div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>Added to your wallet as a founding member</div>
            </div>

            {/* Founding badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', borderRadius: 10, padding: '0.6rem 1.2rem', marginBottom: '1.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>🏅</span>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fbbf24' }}>Founding Member</div>
                <div style={{ fontSize: '0.72rem', color: '#92400e' }}>Badge awarded to your profile</div>
              </div>
            </div>

            <button
              className="ob-btn-primary"
              onClick={() => {
                window.location.href = '/dashboard'
              }}
            >
              Go to my dashboard →
            </button>

            <button onClick={() => window.location.href = '/feed'} style={{ marginTop: '0.75rem', width: '100%', background: 'transparent', border: 'none', color: '#64748b', fontSize: '0.82rem', cursor: 'pointer' }}>
              Go to feed instead
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
