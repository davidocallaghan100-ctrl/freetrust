'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Prefs {
  messages: boolean
  orders: boolean
  trust: boolean
  reviews: boolean
  gig_liked: boolean
  system: boolean
  email_digest: boolean
}

const defaultPrefs: Prefs = {
  messages: true,
  orders: true,
  trust: true,
  reviews: true,
  gig_liked: true,
  system: true,
  email_digest: false,
}

const PREF_CONFIG: { key: keyof Prefs; label: string; desc: string; icon: string }[] = [
  { key: 'messages', label: 'Messages', desc: 'Notifications when you receive a new message', icon: '💬' },
  { key: 'orders', label: 'Orders', desc: 'Updates on your orders and transactions', icon: '📦' },
  { key: 'trust', label: 'Trust Tokens', desc: 'Earned trust token notifications', icon: '₮' },
  { key: 'reviews', label: 'Reviews', desc: 'When someone leaves a review on your services', icon: '⭐' },
  { key: 'gig_liked', label: 'Gig Likes', desc: 'When someone likes your gig or listing', icon: '❤️' },
  { key: 'system', label: 'System Alerts', desc: 'Platform updates and important system notices', icon: '🔔' },
  { key: 'email_digest', label: 'Email Digest', desc: 'Receive a daily summary of your notifications by email', icon: '📧' },
]

export default function NotificationPreferencesPage() {
  const router = useRouter()
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login?redirect=/notifications/preferences')
      } else {
        setAuthed(true)
      }
    })
  }, [router])

  useEffect(() => {
    if (!authed) return
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(data => {
        if (data.preferences) {
          setPrefs({
            messages: data.preferences.messages ?? true,
            orders: data.preferences.orders ?? true,
            trust: data.preferences.trust ?? true,
            reviews: data.preferences.reviews ?? true,
            gig_liked: data.preferences.gig_liked ?? true,
            system: data.preferences.system ?? true,
            email_digest: data.preferences.email_digest ?? false,
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [authed])

  const handleToggle = (key: keyof Prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  if (authed === null) return null

  return (
    <>
      <style>{`
        .np-page { min-height: 100vh; background: #0f172a; padding: 2rem 1.25rem; }
        .np-inner { max-width: 600px; margin: 0 auto; }
        .np-back { display: inline-flex; align-items: center; gap: 0.4rem; color: #64748b; text-decoration: none; font-size: 0.85rem; font-weight: 500; margin-bottom: 1.5rem; transition: color 0.15s; }
        .np-back:hover { color: #94a3b8; }
        .np-title { font-size: 1.6rem; font-weight: 900; color: #f1f5f9; margin-bottom: 0.35rem; }
        .np-sub { font-size: 0.88rem; color: #64748b; margin-bottom: 1.75rem; }
        .np-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; overflow: hidden; margin-bottom: 1.25rem; }
        .np-card-title { font-size: 0.75rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; padding: 0.85rem 1.25rem 0.5rem; }
        .np-row { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(56,189,248,0.06); }
        .np-row:last-child { border-bottom: none; }
        .np-row-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1rem; background: rgba(56,189,248,0.1); flex-shrink: 0; }
        .np-row-text { flex: 1; min-width: 0; }
        .np-row-label { font-size: 0.9rem; font-weight: 600; color: #f1f5f9; }
        .np-row-desc { font-size: 0.78rem; color: #64748b; margin-top: 0.1rem; }
        .np-toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
        .np-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
        .np-toggle-track {
          position: absolute;
          inset: 0;
          border-radius: 12px;
          background: #334155;
          transition: background 0.2s;
          cursor: pointer;
        }
        .np-toggle input:checked + .np-toggle-track { background: #38bdf8; }
        .np-toggle-thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #fff;
          transition: transform 0.2s;
          pointer-events: none;
        }
        .np-toggle input:checked ~ .np-toggle-thumb { transform: translateX(20px); }
        .np-save-btn {
          width: 100%;
          padding: 0.9rem;
          background: #38bdf8;
          color: #0f172a;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .np-save-btn:hover { opacity: 0.88; }
        .np-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .np-toast {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(52,211,153,0.12);
          border: 1px solid rgba(52,211,153,0.3);
          color: #34d399;
          border-radius: 8px;
          padding: 0.7rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 1rem;
          animation: np-fadein 0.2s ease;
        }
        @keyframes np-fadein { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
        @media (max-width: 600px) {
          .np-page { padding: 1.25rem 1rem; }
          .np-title { font-size: 1.3rem; }
        }
      `}</style>

      <main className="np-page">
        <div className="np-inner">
          <Link href="/notifications" className="np-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back to Notifications
          </Link>

          <h1 className="np-title">Notification Preferences</h1>
          <p className="np-sub">Choose what notifications you receive and how you receive them.</p>

          {saved && (
            <div className="np-toast">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
              Preferences saved successfully!
            </div>
          )}

          {loading ? (
            <div style={{ background: '#1e293b', borderRadius: 12, padding: '3rem', textAlign: 'center', color: '#64748b', border: '1px solid rgba(56,189,248,0.1)' }}>
              Loading preferences...
            </div>
          ) : (
            <>
              <div className="np-card">
                <div className="np-card-title">In-App Notifications</div>
                {PREF_CONFIG.filter(p => p.key !== 'email_digest').map(item => (
                  <div className="np-row" key={item.key}>
                    <div className="np-row-icon">{item.icon}</div>
                    <div className="np-row-text">
                      <div className="np-row-label">{item.label}</div>
                      <div className="np-row-desc">{item.desc}</div>
                    </div>
                    <label className="np-toggle" aria-label={`Toggle ${item.label}`}>
                      <input
                        type="checkbox"
                        checked={prefs[item.key]}
                        onChange={() => handleToggle(item.key)}
                      />
                      <span className="np-toggle-track" />
                      <span className="np-toggle-thumb" />
                    </label>
                  </div>
                ))}
              </div>

              <div className="np-card">
                <div className="np-card-title">Email</div>
                {PREF_CONFIG.filter(p => p.key === 'email_digest').map(item => (
                  <div className="np-row" key={item.key}>
                    <div className="np-row-icon">{item.icon}</div>
                    <div className="np-row-text">
                      <div className="np-row-label">{item.label}</div>
                      <div className="np-row-desc">{item.desc}</div>
                    </div>
                    <label className="np-toggle" aria-label={`Toggle ${item.label}`}>
                      <input
                        type="checkbox"
                        checked={prefs[item.key]}
                        onChange={() => handleToggle(item.key)}
                      />
                      <span className="np-toggle-track" />
                      <span className="np-toggle-thumb" />
                    </label>
                  </div>
                ))}
              </div>

              <button
                className="np-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Preferences'}
              </button>
            </>
          )}
        </div>
      </main>
    </>
  )
}
