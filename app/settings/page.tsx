'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string | null
  username: string | null
  bio: string | null
  location: string | null
  website: string | null
  avatar_url: string | null
  privacy_settings: Record<string, unknown> | null
  notification_prefs: Record<string, unknown> | null
  stripe_account_id: string | null
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

type Tab = 'account' | 'privacy' | 'notifications' | 'trust' | 'stripe' | 'danger'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'account',       label: 'Account',        icon: '👤' },
  { id: 'privacy',       label: 'Privacy',         icon: '🔒' },
  { id: 'notifications', label: 'Notifications',   icon: '🔔' },
  { id: 'trust',         label: 'Trust Breakdown', icon: '₮'  },
  { id: 'stripe',        label: 'Stripe Connect',  icon: '💳' },
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
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('account')

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
          {activeTab === 'stripe' && (
            <StripeTab profile={profile} />
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
    full_name: profile.full_name ?? '',
    username: profile.username ?? '',
    bio: profile.bio ?? '',
    location: profile.location ?? '',
    website: profile.website ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? '')
  const fileRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, avatar_url: avatarUrl }),
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
                {getInitials(form.full_name, user.email)}
              </div>
            )}
            <div className="avatar-overlay">
              {avatarUploading ? 'Uploading…' : 'Change\nPhoto'}
            </div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>{form.full_name || 'Your Name'}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{user.email}</div>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ marginTop: 8, background: 'transparent', border: '1px solid #334155', color: '#94a3b8', borderRadius: 6, padding: '4px 12px', fontSize: 12, cursor: 'pointer' }}
            >
              Upload photo
            </button>
          </div>
        </div>

        {/* Fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label className="field-label">Full name</label>
            <input
              className="field-input"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="field-label">Username</label>
            <input
              className="field-input"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="janedoe"
            />
          </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label className="field-label">Location</label>
            <input
              className="field-input"
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Dublin, Ireland"
            />
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
