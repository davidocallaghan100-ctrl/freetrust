'use client'

import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import LocationPicker from '@/components/location/LocationPicker'
import { EMPTY_LOCATION, type StructuredLocation } from '@/lib/geo'
import { CURRENCIES, useCurrency, type CurrencyCode } from '@/context/CurrencyContext'
import { SOCIAL_PLATFORMS, isValidSocialUrl, normaliseSocialUrl } from '@/components/social/SocialLinks'

// Per-platform placeholder text shown in the social links form. Hardcoded
// rather than embedded in the SocialLinks component so the public-facing
// component stays free of "form" concerns.
const SOCIAL_PLACEHOLDERS: Record<string, string> = {
  linkedin_url:  'https://linkedin.com/in/yourname',
  instagram_url: 'https://instagram.com/yourhandle',
  twitter_url:   'https://x.com/yourhandle',
  github_url:    'https://github.com/yourhandle',
  tiktok_url:    'https://tiktok.com/@yourhandle',
  youtube_url:   'https://youtube.com/@yourchannel',
  website_url:   'https://yoursite.com',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  username: string | null
  bio: string | null
  location: string | null
  website: string | null
  avatar_url: string | null
  privacy_settings: Record<string, unknown> | null
  notification_prefs: Record<string, unknown> | null
  stripe_account_id: string | null
  // Globalisation fields
  country?: string | null
  region?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  location_label?: string | null
  currency_code?: string | null
  // Social link fields (20260413_profiles_social_links.sql)
  linkedin_url?:  string | null
  instagram_url?: string | null
  twitter_url?:   string | null
  github_url?:    string | null
  tiktok_url?:    string | null
  youtube_url?:   string | null
  website_url?:   string | null
}

interface TrustBalance {
  balance: number
  lifetime: number
}

interface TrustLedgerEntry {
  id: string
  amount: number
  type: string
  description: string | null
  created_at: string
}

type Tab = 'account' | 'privacy' | 'notifications' | 'trust' | 'referral' | 'stripe' | 'security' | 'danger'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'account',       label: 'Account',        icon: '👤' },
  { id: 'privacy',       label: 'Privacy',         icon: '🔒' },
  { id: 'notifications', label: 'Notifications',   icon: '🔔' },
  { id: 'trust',         label: 'Trust Breakdown', icon: '₮'  },
  { id: 'referral',      label: 'Refer & Earn',    icon: '🎁' },
  { id: 'stripe',        label: 'Stripe Connect',  icon: '💳' },
  { id: 'security',      label: 'Security',        icon: '🛡️'  },
  { id: 'danger',        label: 'Danger Zone',     icon: '⚠️'  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return parts[0].slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return '?'
}

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <Suspense fallback={<div style={{ color: '#64748b', padding: 24 }}>Loading settings…</div>}>
      <SettingsPageInner />
    </Suspense>
  )
}

function SettingsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'account'
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>(
    ['account', 'privacy', 'notifications', 'trust', 'referral', 'stripe', 'security', 'danger'].includes(initialTab)
      ? initialTab
      : 'account'
  )

  useEffect(() => {
    const supabase = createClient()
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) {
        router.push('/auth/signin')
        return
      }
      setUser(u)
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.id)
        .single()
      setProfile(prof)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b', fontSize: 14 }}>Loading settings…</div>
      </div>
    )
  }

  if (!user || !profile) return null

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingTop: 80 }}>
      <style>{`
        .settings-layout { max-width: 1000px; margin: 0 auto; padding: 24px 16px 80px; display: flex; gap: 24px; }
        .settings-sidebar { width: 220px; flex-shrink: 0; }
        .settings-main { flex: 1; min-width: 0; }
        .tab-btn { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 14px; border-radius: 10px; border: none; background: transparent; color: #94a3b8; cursor: pointer; font-size: 14px; font-weight: 500; text-align: left; transition: all 0.15s; margin-bottom: 2px; }
        .tab-btn:hover { background: #1e293b; color: #f1f5f9; }
        .tab-btn.active { background: #1e3a5f; color: #38bdf8; }
        .tab-icon { font-size: 16px; width: 20px; text-align: center; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 24px; margin-bottom: 20px; }
        .section-title { font-size: 18px; font-weight: 700; color: #f1f5f9; margin: 0 0 4px; }
        .section-desc { font-size: 13px; color: #64748b; margin: 0 0 20px; }
        .field-label { font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 6px; display: block; }
        .field-input { width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 10px 12px; color: #f1f5f9; font-size: 14px; outline: none; box-sizing: border-box; transition: border-color 0.15s; }
        .field-input:focus { border-color: #38bdf8; }
        .field-textarea { resize: vertical; min-height: 80px; }
        .save-btn { background: #38bdf8; color: #0f172a; border: none; border-radius: 8px; padding: 10px 24px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
        .save-btn:hover { opacity: 0.9; }
        .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #1e293b; }
        .toggle-row:last-child { border-bottom: none; }
        .toggle-label { font-size: 14px; color: #f1f5f9; }
        .toggle-desc { font-size: 12px; color: #64748b; margin-top: 2px; }
        .toggle { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
        .toggle input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; inset: 0; background: #334155; border-radius: 24px; cursor: pointer; transition: background 0.2s; }
        .toggle input:checked + .toggle-slider { background: #38bdf8; }
        .toggle-slider::before { content: ''; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: transform 0.2s; }
        .toggle input:checked + .toggle-slider::before { transform: translateX(20px); }
        .select-input { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 12px; color: #f1f5f9; font-size: 14px; cursor: pointer; outline: none; }
        .trust-bar-wrap { background: #0f172a; border-radius: 8px; overflow: hidden; height: 8px; margin: 8px 0; }
        .trust-bar-fill { height: 100%; border-radius: 8px; transition: width 0.5s; }
        .ledger-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #1e2d40; }
        .ledger-row:last-child { border-bottom: none; }
        .ledger-amount { font-size: 14px; font-weight: 600; }
        .ledger-amount.positive { color: #34d399; }
        .ledger-amount.negative { color: #f87171; }
        .danger-btn { background: transparent; border: 1px solid #ef4444; color: #ef4444; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
        .danger-btn:hover { background: #ef4444; color: white; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .modal-box { background: #1e293b; border: 1px solid #334155; border-radius: 14px; padding: 28px; max-width: 400px; width: 100%; }
        .avatar-wrap { position: relative; width: 80px; height: 80px; border-radius: 50%; overflow: hidden; cursor: pointer; flex-shrink: 0; }
        .avatar-img { width: 100%; height: 100%; object-fit: cover; }
        .avatar-fallback { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; background: linear-gradient(135deg, #38bdf8, #0284c7); color: white; }
        .avatar-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.15s; font-size: 11px; color: white; text-align: center; }
        .avatar-wrap:hover .avatar-overlay { opacity: 1; }
        .stripe-badge { display: inline-flex; align-items: center; gap: 6px; background: #0d2137; border: 1px solid #38bdf8; border-radius: 8px; padding: 6px 14px; font-size: 13px; color: #38bdf8; }
        .stripe-btn { background: #635bff; color: white; border: none; border-radius: 8px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; text-decoration: none; display: inline-block; }
        .stripe-btn:hover { opacity: 0.9; }
        .success-toast { position: fixed; bottom: 24px; right: 24px; background: #166534; border: 1px solid #16a34a; color: #bbf7d0; border-radius: 10px; padding: 12px 20px; font-size: 14px; z-index: 999; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @media (max-width: 640px) {
          .settings-layout { flex-direction: column; gap: 16px; }
          .settings-sidebar { width: 100%; }
          .sidebar-tabs { display: flex; overflow-x: auto; gap: 6px; padding-bottom: 4px; }
          .tab-btn { white-space: nowrap; padding: 8px 12px; }
        }
      `}</style>

      <div className="settings-layout">
        {/* Sidebar */}
        <aside className="settings-sidebar">
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, paddingLeft: 14 }}>Settings</h1>
          <div className="sidebar-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Main content */}
        <main className="settings-main">
          {activeTab === 'account' && (
            <AccountTab user={user} profile={profile} onSaved={setProfile} />
          )}
          {activeTab === 'privacy' && (
            <PrivacyTab profile={profile} onSaved={setProfile} />
          )}
          {activeTab === 'notifications' && (
            <NotificationsTab profile={profile} onSaved={setProfile} />
          )}
          {activeTab === 'trust' && (
            <TrustTab userId={user.id} />
          )}
          {activeTab === 'referral' && (
            <ReferralTab />
          )}
          {activeTab === 'stripe' && (
            <StripeTab profile={profile} />
          )}
          {activeTab === 'security' && (
            <SecurityTab user={user} />
          )}
          {activeTab === 'danger' && (
            <DangerTab onDeleted={() => router.push('/')} />
          )}
        </main>
      </div>
    </div>
  )
}

// ── Account Tab ────────────────────────────────────────────────────────────────

function AccountTab({
  user,
  profile,
  onSaved,
}: {
  user: User
  profile: Profile
  onSaved: (p: Profile) => void
}) {
  const [form, setForm] = useState({
    first_name: profile.first_name ?? '',
    last_name: profile.last_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
  })
  // Social links form — one entry per platform. Stored as raw user input
  // (validated locally before save) so the user sees what they typed.
  const [socials, setSocials] = useState({
    linkedin_url:  profile.linkedin_url  ?? '',
    instagram_url: profile.instagram_url ?? '',
    twitter_url:   profile.twitter_url   ?? '',
    github_url:    profile.github_url    ?? '',
    tiktok_url:    profile.tiktok_url    ?? '',
    youtube_url:   profile.youtube_url   ?? '',
    website_url:   profile.website_url   ?? '',
  })
  type SocialField = keyof typeof socials
  // Globalisation — structured location + preferred currency
  const [structLoc, setStructLoc] = useState<StructuredLocation>({
    country:        profile.country        ?? null,
    region:         profile.region         ?? null,
    city:           profile.city           ?? null,
    latitude:       profile.latitude       ?? null,
    longitude:      profile.longitude      ?? null,
    location_label: profile.location_label ?? profile.location ?? null,
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  const { currency, setCurrency } = useCurrency()

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      showToast('First and last name are required.')
      return
    }
    // Validate every non-empty social URL before contacting the server.
    // The check is deliberately lenient — accepts bare hosts like
    // "linkedin.com/in/foo" as well as full https:// URLs.
    for (const key of Object.keys(socials) as SocialField[]) {
      if (!isValidSocialUrl(socials[key])) {
        const platform = SOCIAL_PLATFORMS.find(p => p.field === key)
        showToast(`Invalid ${platform?.label ?? key} URL — please check the format.`)
        return
      }
    }
    setSaving(true)
    try {
      // Normalise: empty → null, bare host → https://...
      const normalisedSocials = Object.fromEntries(
        (Object.keys(socials) as SocialField[]).map(k => [k, normaliseSocialUrl(socials[k])])
      )
      const res = await fetch('/api/settings/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          avatar_url: avatarUrl,
          // Globalisation: persist the structured location so browse
          // pages can default to the user's home city, and the user's
          // preferred display currency.
          location:       structLoc.location_label ?? form.location,
          country:        structLoc.country,
          region:         structLoc.region,
          city:           structLoc.city,
          latitude:       structLoc.latitude,
          longitude:      structLoc.longitude,
          location_label: structLoc.location_label,
          currency_code:  currency.code,
          // Social links — normalised
          ...normalisedSocials,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        onSaved(data.profile)
        showToast('Account saved!')
      } else {
        showToast('Failed to save. Try again.')
      }
    } catch {
      showToast('Network error.')
    }
    setSaving(false)
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${user.id}/avatar-${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setAvatarUrl(publicUrl)
    } catch {
      showToast('Upload failed.')
    }
    setAvatarUploading(false)
  }

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Account Details</h2>
        <p className="section-desc">Update your public profile information.</p>

        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div
            className="avatar-wrap"
            onClick={() => fileRef.current?.click()}
            title="Click to change photo"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="avatar-img" />
            ) : (
              <div className="avatar-fallback">
                {getInitials(`${form.first_name} ${form.last_name}`.trim(), user.email)}
              </div>
            )}
            <div className="avatar-overlay">
              {avatarUploading ? 'Uploading…' : 'Change\nPhoto'}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
              {`${form.first_name} ${form.last_name}`.trim() || 'Your Name'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{user.email}</div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ marginTop: 8, background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              Upload photo
            </button>
          </div>
        </div>

        {/* Name fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">First name</label>
            <input
              className="field-input"
              value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Jane"
              required
            />
          </div>
          <div>
            <label className="field-label">Last name</label>
            <input
              className="field-input"
              value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Doe"
              required
            />
          </div>
        </div>

        {/* Username */}
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Username</label>
          <input
            className="field-input"
            value={form.username}
            onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            placeholder="janedoe"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">Bio</label>
          <textarea
            className="field-input field-textarea"
            value={form.bio}
            onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="Tell the community about yourself…"
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="field-label">🌍 Location</label>
          <LocationPicker
            value={structLoc}
            onChange={setStructLoc}
            placeholder="Dublin, Ireland"
          />
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
            Used to default your browse filters to listings near you.
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label className="field-label">💱 Preferred currency</label>
            <select
              className="field-input"
              value={currency.code}
              onChange={e => setCurrency(e.target.value as CurrencyCode)}
            >
              {CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Website</label>
            <input
              className="field-input"
              value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
              placeholder="https://yoursite.com"
            />
          </div>
        </div>

        <button className="save-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      {/* ── Social Links ─────────────────────────────────────────────────
          A separate card so the visual hierarchy mirrors how social links
          appear on the public profile page. Each platform gets its own
          input row with a brand-coloured icon prefix and a placeholder
          showing the expected URL format. Validation runs on save (see
          handleSave above) — empty fields are never validated. */}
      <div className="card" style={{ marginTop: 24 }}>
        <h2 className="section-title">🔗 Social Links</h2>
        <p className="section-desc">Show the community where to find you. Empty fields are hidden on your public profile.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {SOCIAL_PLATFORMS.map(platform => {
            const field = platform.field as SocialField
            const value = socials[field]
            const placeholder = SOCIAL_PLACEHOLDERS[field] ?? 'https://…'
            const invalid = value.length > 0 && !isValidSocialUrl(value)
            const Icon = platform.Icon
            return (
              <div key={platform.key}>
                <label
                  className="field-label"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 22, height: 22, borderRadius: 5,
                    background: 'rgba(15,23,42,0.6)',
                    border: '1px solid rgba(148,163,184,0.18)',
                    color: platform.brand,
                    flexShrink: 0,
                  }}>
                    <Icon size={13} />
                  </span>
                  {platform.label}
                </label>
                <input
                  className="field-input"
                  type="url"
                  inputMode="url"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  value={value}
                  onChange={e => setSocials(s => ({ ...s, [field]: e.target.value }))}
                  placeholder={placeholder}
                  style={invalid ? { borderColor: '#f87171' } : undefined}
                  aria-invalid={invalid}
                />
                {invalid && (
                  <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>
                    Doesn&apos;t look like a valid URL — try {placeholder}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <button className="save-btn" onClick={handleSave} disabled={saving} style={{ marginTop: 20 }}>
          {saving ? 'Saving…' : 'Save social links'}
        </button>
      </div>

      {toast && <div className="success-toast">{toast}</div>}
    </div>
  )
}

// ── Privacy Tab ────────────────────────────────────────────────────────────────

function PrivacyTab({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const priv = (profile.privacy_settings ?? {}) as Record<string, unknown>
  const [visibility, setVisibility] = useState<string>((priv.profile_visibility as string) ?? 'public')
  const [showTrust, setShowTrust] = useState<boolean>((priv.show_trust_score as boolean) ?? true)
  const [showOnline, setShowOnline] = useState<boolean>((priv.show_online_status as boolean) ?? true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/privacy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_visibility: visibility,
          show_trust_score: showTrust,
          show_online_status: showOnline,
        }),
      })
      if (res.ok) {
        onSaved({ ...profile, privacy_settings: { profile_visibility: visibility, show_trust_score: showTrust, show_online_status: showOnline } })
        showToast('Privacy settings saved!')
      } else {
        showToast('Failed to save.')
      }
    } catch {
      showToast('Network error.')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Privacy</h2>
        <p className="section-desc">Control who can see your profile and data.</p>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Profile visibility</div>
            <div className="toggle-desc">Who can view your profile page</div>
          </div>
          <select className="select-input" value={visibility} onChange={e => setVisibility(e.target.value)}>
            <option value="public">Public</option>
            <option value="connections">Connections Only</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Show Trust score publicly</div>
            <div className="toggle-desc">Display your ₮ balance on your profile</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showTrust} onChange={e => setShowTrust(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Show online status</div>
            <div className="toggle-desc">Let others see when you're active</div>
          </div>
          <label className="toggle">
            <input type="checkbox" checked={showOnline} onChange={e => setShowOnline(e.target.checked)} />
            <span className="toggle-slider" />
          </label>
        </div>

        <div style={{ marginTop: 20 }}>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save privacy settings'}
          </button>
        </div>
      </div>
      {toast && <div className="success-toast">{toast}</div>}
    </div>
  )
}

// ── Notifications Tab ──────────────────────────────────────────────────────────

function NotificationsTab({ profile, onSaved }: { profile: Profile; onSaved: (p: Profile) => void }) {
  const np = (profile.notification_prefs ?? {}) as Record<string, unknown>
  const [emailDigest, setEmailDigest] = useState<string>((np.email_digest as string) ?? 'daily')
  const [push, setPush] = useState<boolean>((np.push_notifications as boolean) ?? true)
  const [messages, setMessages] = useState<boolean>((np.message_alerts as boolean) ?? true)
  const [trust, setTrust] = useState<boolean>((np.trust_alerts as boolean) ?? true)
  const [followers, setFollowers] = useState<boolean>((np.follower_alerts as boolean) ?? true)
  const [claps, setClaps] = useState<boolean>((np.clap_alerts as boolean) ?? true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_digest: emailDigest,
          push_notifications: push,
          message_alerts: messages,
          trust_alerts: trust,
          follower_alerts: followers,
          clap_alerts: claps,
        }),
      })
      if (res.ok) {
        onSaved({ ...profile, notification_prefs: { email_digest: emailDigest, push_notifications: push, message_alerts: messages, trust_alerts: trust, follower_alerts: followers, clap_alerts: claps } })
        showToast('Notification preferences saved!')
      } else {
        showToast('Failed to save.')
      }
    } catch {
      showToast('Network error.')
    }
    setSaving(false)
  }

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Notifications</h2>
        <p className="section-desc">Choose what updates you want to receive.</p>

        <div className="toggle-row">
          <div>
            <div className="toggle-label">Email digest</div>
            <div className="toggle-desc">How often to receive email summaries</div>
          </div>
          <select className="select-input" value={emailDigest} onChange={e => setEmailDigest(e.target.value)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="off">Off</option>
          </select>
        </div>

        {([
          { label: 'Push notifications',  desc: 'Browser & mobile push alerts',   val: push,      set: setPush },
          { label: 'New message alerts',  desc: 'When someone messages you',       val: messages,  set: setMessages },
          { label: 'Trust received',      desc: 'When you earn Trust tokens',      val: trust,     set: setTrust },
          { label: 'New follower alerts', desc: 'When someone follows you',        val: followers, set: setFollowers },
          { label: 'Article clap alerts', desc: 'When someone claps your article', val: claps,     set: setClaps },
        ] as { label: string; desc: string; val: boolean; set: (v: boolean) => void }[]).map(item => (
          <div key={item.label} className="toggle-row">
            <div>
              <div className="toggle-label">{item.label}</div>
              <div className="toggle-desc">{item.desc}</div>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={item.val} onChange={e => item.set(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
          </div>
        ))}

        <div style={{ marginTop: 20 }}>
          <button className="save-btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save notification preferences'}
          </button>
        </div>
      </div>

      {/* New: per-email-type preferences backed by notification_preferences table */}
      <EmailPreferencesCard />

      {toast && <div className="success-toast">{toast}</div>}
    </div>
  )
}

// ── Email preferences (per-type toggles) ──────────────────────────────────────

interface EmailPreference {
  type: string
  label: string
  description: string
  category: string
  email_enabled: boolean
  push_enabled: boolean
}

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  social:   { label: 'Social',       icon: '👥' },
  commerce: { label: 'Commerce',     icon: '🛍' },
  wallet:   { label: 'Wallet & Trust', icon: '💳' },
  account:  { label: 'Account',      icon: '👤' },
  digest:   { label: 'Digests',      icon: '📰' },
}
const CATEGORY_ORDER = ['social', 'commerce', 'wallet', 'account', 'digest']

function EmailPreferencesCard() {
  const [prefs, setPrefs] = useState<EmailPreference[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings/notifications')
        if (res.ok) {
          const data = await res.json() as { preferences: EmailPreference[] }
          setPrefs(data.preferences ?? [])
        }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const toggleEmail = async (type: string, next: boolean) => {
    // Optimistic update
    setPrefs(prev => prev.map(p => p.type === type ? { ...p, email_enabled: next } : p))
    setSaving(type)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email_enabled: next }),
      })
      if (!res.ok) throw new Error()
      setToast(next ? 'Notifications enabled' : 'Notifications disabled')
      setTimeout(() => setToast(''), 2000)
    } catch {
      // Rollback
      setPrefs(prev => prev.map(p => p.type === type ? { ...p, email_enabled: !next } : p))
      setToast('Could not save — try again')
      setTimeout(() => setToast(''), 3000)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h2 className="section-title">Email notifications by type</h2>
        <p style={{ color: '#64748b', fontSize: 13 }}>Loading preferences…</p>
      </div>
    )
  }

  const grouped = prefs.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {} as Record<string, EmailPreference[]>)

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 className="section-title">Email notifications</h2>
      <p className="section-desc">Choose exactly which emails you want to receive. Transactional emails like payment receipts and order confirmations will always be sent.</p>

      {CATEGORY_ORDER.filter(cat => grouped[cat]?.length).map(cat => {
        const meta = CATEGORY_META[cat]
        return (
          <div key={cat} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{meta?.icon ?? '•'}</span>
              <span>{meta?.label ?? cat}</span>
            </div>
            {grouped[cat].map(p => (
              <div key={p.type} className="toggle-row" style={{ opacity: saving === p.type ? 0.6 : 1 }}>
                <div>
                  <div className="toggle-label">{p.label}</div>
                  <div className="toggle-desc">{p.description}</div>
                </div>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={p.email_enabled}
                    disabled={saving === p.type}
                    onChange={e => toggleEmail(p.type, e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            ))}
          </div>
        )
      })}

      {toast && <div className="success-toast">{toast}</div>}
    </div>
  )
}

// ── Trust Breakdown Tab ────────────────────────────────────────────────────────

function TrustTab({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<TrustBalance | null>(null)
  const [ledger, setLedger] = useState<TrustLedgerEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [{ data: bal }, { data: entries }] = await Promise.all([
        supabase.from('trust_balances').select('balance, lifetime').eq('user_id', userId).maybeSingle(),
        supabase.from('trust_ledger').select('id, amount, type, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
      ])
      setBalance(bal ?? { balance: 0, lifetime: 0 })
      setLedger(entries ?? [])
      setLoading(false)
    }
    load()
  }, [userId])

  if (loading) return <div style={{ color: '#64748b', padding: 24 }}>Loading trust data…</div>

  const earned = ledger.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0)
  const spent = Math.abs(ledger.filter(e => e.amount < 0).reduce((s, e) => s + e.amount, 0))
  const total = earned + spent || 1

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Trust Breakdown</h2>
        <p className="section-desc">Your Trust token history and balance.</p>

        {/* Balance hero */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, background: '#0f172a', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Current balance</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#38bdf8' }}>₮{balance?.balance ?? 0}</div>
          </div>
          <div style={{ flex: 1, background: '#0f172a', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Lifetime earned</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#34d399' }}>₮{balance?.lifetime ?? 0}</div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#34d399' }}>Earned ₮{earned}</span>
            <span style={{ fontSize: 12, color: '#f87171' }}>Spent ₮{spent}</span>
          </div>
          <div style={{ display: 'flex', gap: 4, height: 10, borderRadius: 8, overflow: 'hidden', background: '#0f172a' }}>
            <div style={{ width: `${(earned / total) * 100}%`, background: '#34d399', borderRadius: '8px 0 0 8px' }} />
            <div style={{ width: `${(spent / total) * 100}%`, background: '#f87171', borderRadius: '0 8px 8px 0' }} />
          </div>
        </div>

        {/* Ledger */}
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Recent transactions</h3>
        {ledger.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>No transactions yet.</div>
        ) : (
          ledger.map(entry => (
            <div key={entry.id} className="ledger-row">
              <div>
                <div style={{ fontSize: 13, color: '#f1f5f9' }}>{entry.description ?? entry.type}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{timeAgo(entry.created_at)}</div>
              </div>
              <div className={`ledger-amount ${entry.amount >= 0 ? 'positive' : 'negative'}`}>
                {entry.amount >= 0 ? '+' : ''}₮{entry.amount}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Referral Tab ───────────────────────────────────────────────────────────────

interface ReferralRow {
  id: string
  referred_id: string
  referred_name: string
  referred_avatar: string | null
  status: 'pending' | 'completed'
  reward_credited: boolean
  reward_amount: number
  completed_at: string | null
  created_at: string
}

interface ReferralData {
  referral_code: string | null
  stats: { total: number; pending: number; completed: number; tokens_earned: number }
  referrals: ReferralRow[]
}

function ReferralTab() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/referrals')
        if (res.ok) {
          const json = await res.json() as ReferralData
          setData(json)
        }
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  if (loading) return <div style={{ color: '#64748b', padding: 24 }}>Loading referral data…</div>

  const code = data?.referral_code ?? ''
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteUrl = code ? `${origin}/invite/${code}` : ''
  const shareMessage = `Join me on FreeTrust — the trust-powered marketplace for creators. Sign up with my link and we both earn trust tokens: ${inviteUrl}`

  const handleCopy = async () => {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      showToast('Link copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      showToast('Could not copy — please copy manually')
    }
  }

  const handleNativeShare = async () => {
    if (!inviteUrl) return
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Join me on FreeTrust',
          text: shareMessage,
          url: inviteUrl,
        })
      } catch { /* user cancelled */ }
    } else {
      handleCopy()
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`
  const twitterUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`
  const emailUrl    = `mailto:?subject=${encodeURIComponent('Join me on FreeTrust')}&body=${encodeURIComponent(shareMessage)}`

  const stats = data?.stats ?? { total: 0, pending: 0, completed: 0, tokens_earned: 0 }
  const referrals = data?.referrals ?? []

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: '10px 18px', fontSize: 13, color: '#f1f5f9', zIndex: 9999, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      <div className="card">
        <h2 className="section-title">Refer & Earn</h2>
        <p className="section-desc">Invite friends to FreeTrust. When they complete their first transaction, you earn <strong style={{ color: '#38bdf8' }}>₮50 trust tokens</strong>.</p>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9' }}>{stats.total}</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#f59e0b' }}>{stats.pending}</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Completed</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#34d399' }}>{stats.completed}</div>
          </div>
          <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Earned</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#38bdf8' }}>₮{stats.tokens_earned}</div>
          </div>
        </div>

        {/* Referral link + copy */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' }}>Your referral link</label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <input
            readOnly
            value={inviteUrl}
            onClick={e => (e.target as HTMLInputElement).select()}
            style={{ flex: 1, minWidth: 220, background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#f1f5f9', outline: 'none', fontFamily: 'monospace' }}
          />
          <button
            onClick={handleCopy}
            style={{ background: copied ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border: copied ? '1px solid rgba(52,211,153,0.4)' : 'none', color: copied ? '#34d399' : '#0f172a', fontWeight: 700, fontSize: 13, padding: '12px 22px', borderRadius: 10, cursor: 'pointer' }}
          >
            {copied ? '✓ Copied' : '📋 Copy'}
          </button>
        </div>

        {/* Share buttons */}
        <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' }}>Share</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', color: '#25d366', fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            💬 WhatsApp
          </a>
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: 'rgba(29,161,242,0.12)', border: '1px solid rgba(29,161,242,0.3)', color: '#1da1f2', fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            🐦 Twitter
          </a>
          <a
            href={emailUrl}
            style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#a78bfa', fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            ✉️ Email
          </a>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={handleNativeShare}
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)', color: '#94a3b8', fontSize: 13, fontWeight: 600, padding: '10px 16px', borderRadius: 10, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'inherit' }}
            >
              ↗ More…
            </button>
          )}
        </div>

        {/* How it works */}
        <div style={{ background: '#0f172a', borderRadius: 10, padding: '14px 16px', marginBottom: 20, border: '1px solid rgba(56,189,248,0.12)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>How it works</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.7 }}>
            <li>Share your link with a friend</li>
            <li>They sign up using your link</li>
            <li>When they complete their first transaction, you earn ₮50 trust</li>
          </ol>
        </div>

        {/* Referrals list */}
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>Your referrals</h3>
        {referrals.length === 0 ? (
          <div style={{ color: '#64748b', fontSize: 13, padding: '12px 0' }}>
            No referrals yet. Share your link above to get started!
          </div>
        ) : (
          <div>
            {referrals.map(r => (
              <div key={r.id} className="ledger-row" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                {r.referred_avatar
                  ? <img src={r.referred_avatar} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
                      {(r.referred_name[0] ?? '?').toUpperCase()}
                    </div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{r.referred_name}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                    Joined {timeAgo(r.created_at)}
                    {r.status === 'completed' && r.completed_at && ` · Rewarded ${timeAgo(r.completed_at)}`}
                  </div>
                </div>
                {r.status === 'completed' ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '4px 10px' }}>
                    +₮{r.reward_amount}
                  </span>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 999, padding: '4px 10px' }}>
                    Pending
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stripe Tab ─────────────────────────────────────────────────────────────────

function StripeTab({ profile }: { profile: Profile }) {
  const isConnected = !!profile.stripe_account_id
  const [connectUrl, setConnectUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleConnect = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/connect')
      const data = await res.json()
      if (data.url) setConnectUrl(data.url)
    } catch {
      // silently fail
    }
    setLoading(false)
  }, [])

  return (
    <div>
      <div className="card">
        <h2 className="section-title">Stripe Connect</h2>
        <p className="section-desc">Connect your Stripe account to receive payments for your services and products.</p>

        {isConnected ? (
          <div>
            <div className="stripe-badge" style={{ marginBottom: 16 }}>
              <span>✅</span>
              <span>Stripe connected</span>
              {profile.stripe_account_id && (
                <span style={{ color: '#64748b' }}>·· {profile.stripe_account_id.slice(-4)}</span>
              )}
            </div>
            <button
              style={{ background: 'transparent', border: '1px solid #334155', color: '#f87171', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}
            >
              Disconnect Stripe
            </button>
          </div>
        ) : (
          <div>
            <div style={{ background: '#0f172a', borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              <strong style={{ color: '#f1f5f9' }}>Why connect Stripe?</strong><br />
              Accept payments for your services, products, and events directly on FreeTrust. You keep 92–95% of every sale — FreeTrust only takes a small platform fee.
            </div>

            {connectUrl ? (
              <a href={connectUrl} className="stripe-btn" target="_blank" rel="noopener noreferrer">
                Continue on Stripe →
              </a>
            ) : (
              <button className="stripe-btn" onClick={handleConnect} disabled={loading}>
                {loading ? 'Loading…' : 'Connect Stripe to get paid'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Security Tab ───────────────────────────────────────────────────────────────

function SecurityTab({ user }: { user: { email?: string } }) {
  const supabase = createClient()
  const [mfaFactors, setMfaFactors] = useState<{ id: string; friendly_name?: string; factor_type: string; status: string }[]>([])
  const [mfaLoading, setMfaLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [enrollId, setEnrollId] = useState<string | null>(null)
  const [success, setSuccess] = useState('')
  const [unenrolling, setUnenrolling] = useState<string | null>(null)
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  useEffect(() => {
    async function loadFactors() {
      try {
        const { data } = await supabase.auth.mfa.listFactors()
        setMfaFactors((data?.totp ?? []).map(f => ({ ...f, factor_type: 'totp' })))
      } catch { /* ignore */ } finally { setMfaLoading(false) }
    }
    loadFactors()
  }, [supabase])

  const startEnroll = async () => {
    setEnrolling(true)
    setVerifyError('')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' })
      if (error || !data) { setVerifyError(error?.message ?? 'Failed to start 2FA setup'); return }
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
      setEnrollId(data.id)
    } finally { setEnrolling(false) }
  }

  const verifyEnroll = async () => {
    if (!enrollId || !verifyCode) return
    setVerifying(true)
    setVerifyError('')
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrollId, code: verifyCode })
      if (error) { setVerifyError('Invalid code. Please try again.'); return }
      setQrCode(null); setSecret(null); setEnrollId(null); setVerifyCode('')
      setSuccess('Two-factor authentication enabled!')
      const { data } = await supabase.auth.mfa.listFactors()
      setMfaFactors((data?.totp ?? []).map(f => ({ ...f, factor_type: 'totp' })))
    } finally { setVerifying(false) }
  }

  const unenroll = async (factorId: string) => {
    setUnenrolling(factorId)
    try {
      await supabase.auth.mfa.unenroll({ factorId })
      setMfaFactors(prev => prev.filter(f => f.id !== factorId))
      setSuccess('Two-factor authentication removed.')
    } finally { setUnenrolling(null) }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(''); setPwSuccess('')
    if (!pwForm.current) { setPwError('Enter your current password.'); return }
    if (pwForm.newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(pwForm.newPw)) { setPwError('New password must contain an uppercase letter.'); return }
    if (!/[0-9]/.test(pwForm.newPw)) { setPwError('New password must contain a number.'); return }
    if (!/[^A-Za-z0-9]/.test(pwForm.newPw)) { setPwError('New password must contain a special character.'); return }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords don\'t match.'); return }
    setPwLoading(true)
    try {
      // Re-authenticate first
      const { error: reAuthError } = await supabase.auth.signInWithPassword({ email: user.email ?? '', password: pwForm.current })
      if (reAuthError) { setPwError('Current password is incorrect.'); return }
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
      if (error) { setPwError(error.message); return }
      setPwSuccess('Password updated successfully.')
      setPwForm({ current: '', newPw: '', confirm: '' })
    } finally { setPwLoading(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Password change */}
      <div className="card">
        <h2 className="section-title">Change Password</h2>
        <p className="section-desc">Use a strong password: min 8 characters, uppercase, number, and special character.</p>
        <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {['current', 'newPw', 'confirm'].map((key, i) => (
            <div key={key}>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 5 }}>
                {['Current password', 'New password', 'Confirm new password'][i]}
              </label>
              <input
                className="field-input"
                type="password"
                autoComplete={key === 'current' ? 'current-password' : 'new-password'}
                value={pwForm[key as keyof typeof pwForm]}
                onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
          {pwError && <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#fca5a5' }}>{pwError}</div>}
          {pwSuccess && <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#6ee7b7' }}>{pwSuccess}</div>}
          <button type="submit" className="save-btn" disabled={pwLoading}>{pwLoading ? 'Updating…' : 'Update password'}</button>
        </form>
      </div>

      {/* 2FA */}
      <div className="card">
        <h2 className="section-title">Two-Factor Authentication</h2>
        <p className="section-desc">Add an extra layer of security with an authenticator app (Google Authenticator, Authy, etc.).</p>

        {success && <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#6ee7b7', marginBottom: 14 }}>{success}</div>}

        {mfaLoading ? (
          <div style={{ color: '#64748b', fontSize: 13 }}>Loading…</div>
        ) : mfaFactors.length > 0 ? (
          <div>
            {mfaFactors.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #1e293b' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>🔐 {f.friendly_name ?? 'Authenticator App'}</div>
                  <div style={{ fontSize: 12, color: '#22c55e', marginTop: 2 }}>✓ Active</div>
                </div>
                <button
                  className="danger-btn"
                  style={{ fontSize: 12, padding: '6px 12px' }}
                  onClick={() => unenroll(f.id)}
                  disabled={unenrolling === f.id}
                >
                  {unenrolling === f.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        ) : qrCode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: 13, color: '#94a3b8' }}>Scan this QR code with your authenticator app:</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="2FA QR Code" style={{ width: 180, height: 180, borderRadius: 10, background: '#fff', padding: 8 }} />
            {secret && <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#94a3b8', wordBreak: 'break-all' }}>Manual key: <strong style={{ color: '#f1f5f9' }}>{secret}</strong></div>}
            <div>
              <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Enter the 6-digit code from your app:</label>
              <input
                className="field-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={verifyCode}
                onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                style={{ letterSpacing: '0.2em', maxWidth: 160 }}
              />
            </div>
            {verifyError && <div style={{ fontSize: 13, color: '#fca5a5' }}>{verifyError}</div>}
            <button className="save-btn" onClick={verifyEnroll} disabled={verifying || verifyCode.length < 6}>
              {verifying ? 'Verifying…' : 'Enable 2FA'}
            </button>
          </div>
        ) : (
          <div style={{ paddingTop: 8 }}>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>2FA is not enabled on your account.</p>
            <button className="save-btn" onClick={startEnroll} disabled={enrolling}>
              {enrolling ? 'Setting up…' : '+ Enable Two-Factor Authentication'}
            </button>
          </div>
        )}
      </div>

      {/* Sign out all sessions */}
      <div className="card">
        <h2 className="section-title">Active Sessions</h2>
        <p className="section-desc">Sign out of all devices at once. You&apos;ll need to log in again everywhere.</p>
        <button
          className="danger-btn"
          style={{ fontSize: 13 }}
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
        >
          Sign out all sessions
        </button>
      </div>
    </div>
  )
}

// ── Danger Zone Tab ────────────────────────────────────────────────────────────

function DangerTab({ onDeleted }: { onDeleted: () => void }) {
  const [showModal, setShowModal] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      setError('Please type DELETE to confirm.')
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/settings/delete-account', { method: 'DELETE' })
      if (res.ok) {
        onDeleted()
      } else {
        setError('Failed to delete account. Please try again.')
        setDeleting(false)
      }
    } catch {
      setError('Network error. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="card" style={{ borderColor: '#7f1d1d' }}>
        <h2 className="section-title" style={{ color: '#f87171' }}>Danger Zone</h2>
        <p className="section-desc">These actions are irreversible. Please proceed with caution.</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderTop: '1px solid #1e293b' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Delete your account</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
              Permanently removes your profile and data from FreeTrust.
            </div>
          </div>
          <button className="danger-btn" onClick={() => setShowModal(true)}>
            Delete account
          </button>
        </div>
      </div>

      {/* Confirmation modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal-box">
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f87171', marginBottom: 8 }}>Delete account</h3>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
              This action <strong style={{ color: '#f1f5f9' }}>cannot be undone</strong>. Your profile, listings, Trust balance, and all associated data will be permanently removed.
            </p>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
              Type <strong style={{ color: '#f87171' }}>DELETE</strong> to confirm:
            </p>
            <input
              className="field-input"
              value={confirmText}
              onChange={e => { setConfirmText(e.target.value); setError('') }}
              placeholder="DELETE"
              style={{ marginBottom: 12 }}
            />
            {error && <p style={{ color: '#f87171', fontSize: 12, marginBottom: 10 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowModal(false); setConfirmText(''); setError('') }}
                style={{ background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 8, padding: '8px 16px', fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                className="danger-btn"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
