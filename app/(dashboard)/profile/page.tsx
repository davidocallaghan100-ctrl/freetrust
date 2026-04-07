'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ProfilePage() {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    name: 'David O\'Callaghan',
    bio: 'Building open-source trust infrastructure. Founder of FreeTrust.',
    location: 'Dublin, Ireland',
    website: 'https://freetrust.co',
    twitter: '@davidoc',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSave = () => {
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc; }
        .nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; background: rgba(15,23,42,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(12px); }
        .nav-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
        .nav-logo-icon { width: 30px; height: 30px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .nav-logo-text { font-size: 17px; font-weight: 700; color: #f8fafc; }
        .nav-logo-text span { color: #10b981; }
        .nav-actions { display: flex; gap: 12px; align-items: center; }
        .nav-link { font-size: 14px; color: #94a3b8; text-decoration: none; padding: 6px 12px; border-radius: 8px; transition: color 0.2s, background 0.2s; }
        .nav-link:hover { color: #f8fafc; background: rgba(255,255,255,0.05); }
        .nav-link.active { color: #10b981; }

        .page { max-width: 860px; margin: 0 auto; padding: 40px 24px; }

        /* Profile header */
        .profile-header { display: flex; align-items: flex-start; gap: 24px; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 32px; margin-bottom: 28px; flex-wrap: wrap; }
        .avatar { width: 88px; height: 88px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; flex-shrink: 0; border: 3px solid rgba(16,185,129,0.3); }
        .profile-info { flex: 1; min-width: 0; }
        .profile-name { font-size: 24px; font-weight: 800; letter-spacing: -0.4px; margin-bottom: 4px; }
        .profile-bio { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 14px; max-width: 480px; }
        .profile-meta { display: flex; flex-wrap: wrap; gap: 16px; }
        .meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; }
        .profile-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px; }
        .badge { display: inline-flex; align-items: center; gap: 5px; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .badge-green { background: rgba(16,185,129,0.12); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
        .badge-blue { background: rgba(59,130,246,0.12); color: #93c5fd; border: 1px solid rgba(59,130,246,0.2); }
        .badge-purple { background: rgba(139,92,246,0.12); color: #c4b5fd; border: 1px solid rgba(139,92,246,0.2); }

        /* Stats row */
        .stats-row { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 16px; margin-bottom: 28px; }
        .stat-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; text-align: center; }
        .stat-value { font-size: 26px; font-weight: 800; color: #10b981; letter-spacing: -0.5px; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }

        /* Edit form */
        .edit-section { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 20px; padding: 32px; margin-bottom: 24px; }
        .edit-section-title { font-size: 16px; font-weight: 700; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; }
        .field { margin-bottom: 18px; }
        label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 6px; }
        input, textarea { width: 100%; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 10px; padding: 11px 14px; font-size: 14px; color: #f8fafc; outline: none; font-family: inherit; transition: border-color 0.2s, box-shadow 0.2s; resize: vertical; }
        input::placeholder, textarea::placeholder { color: #475569; }
        input:focus, textarea:focus { border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
        input:disabled, textarea:disabled { opacity: 0.6; cursor: not-allowed; background: rgba(15,23,42,0.4); }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 540px) { .two-col { grid-template-columns: 1fr; } }

        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s, transform 0.15s; text-decoration: none; }
        .btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-green { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
        .btn-outline { background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); color: #cbd5e1; }
        .btn-actions { display: flex; gap: 10px; margin-top: 8px; }
        .saved-toast { background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.25); border-radius: 10px; padding: 12px 16px; font-size: 14px; color: #6ee7b7; margin-bottom: 16px; }

        /* Danger zone */
        .danger-zone { background: rgba(239,68,68,0.04); border: 1px solid rgba(239,68,68,0.15); border-radius: 16px; padding: 24px; }
        .danger-title { font-size: 14px; font-weight: 700; color: #f87171; margin-bottom: 8px; }
        .danger-desc { font-size: 13px; color: #64748b; margin-bottom: 16px; line-height: 1.5; }
        .btn-danger { background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
        .btn-danger:hover { background: rgba(239,68,68,0.2); }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🛡</div>
          <span className="nav-logo-text">Free<span>Trust</span></span>
        </Link>
        <div className="nav-actions">
          <Link href="/browse" className="nav-link">Marketplace</Link>
          <Link href="/listings" className="nav-link">My Listings</Link>
          <Link href="/wallet" className="nav-link">Wallet</Link>
          <Link href="/profile" className="nav-link active">Profile</Link>
        </div>
      </nav>

      <div className="page">
        {/* Header */}
        <div className="profile-header">
          <div className="avatar">👤</div>
          <div className="profile-info">
            <div className="profile-name">{form.name}</div>
            <p className="profile-bio">{form.bio}</p>
            <div className="profile-meta">
              {form.location && <span className="meta-item">📍 {form.location}</span>}
              {form.website && <span className="meta-item">🌐 <a href={form.website} style={{ color: '#10b981', textDecoration: 'none' }}>{form.website.replace('https://', '')}</a></span>}
              {form.twitter && <span className="meta-item">𝕏 {form.twitter}</span>}
            </div>
            <div className="profile-badges">
              <span className="badge badge-green">✅ Verified seller</span>
              <span className="badge badge-blue">⭐ Top contributor</span>
              <span className="badge badge-purple">🛡 Trust Builder</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-row">
          {[
            { value: '7', label: 'Tools listed' },
            { value: '€648', label: 'Total earned' },
            { value: '4.9★', label: 'Avg rating' },
            { value: '142', label: 'Customers' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Edit form */}
        <div className="edit-section">
          <div className="edit-section-title">
            Profile settings
            {!editing && (
              <button className="btn btn-outline" onClick={() => setEditing(true)}>✏️ Edit</button>
            )}
          </div>

          {saved && <div className="saved-toast">✅ Profile saved successfully.</div>}

          <div className="two-col">
            <div className="field">
              <label>Full name</label>
              <input name="name" value={form.name} onChange={handleChange} disabled={!editing} />
            </div>
            <div className="field">
              <label>Location</label>
              <input name="location" value={form.location} onChange={handleChange} disabled={!editing} placeholder="City, Country" />
            </div>
          </div>
          <div className="field">
            <label>Bio</label>
            <textarea name="bio" value={form.bio} onChange={handleChange} disabled={!editing} rows={3} placeholder="Tell the community about yourself…" />
          </div>
          <div className="two-col">
            <div className="field">
              <label>Website</label>
              <input name="website" value={form.website} onChange={handleChange} disabled={!editing} placeholder="https://yoursite.com" />
            </div>
            <div className="field">
              <label>Twitter / X handle</label>
              <input name="twitter" value={form.twitter} onChange={handleChange} disabled={!editing} placeholder="@handle" />
            </div>
          </div>

          {editing && (
            <div className="btn-actions">
              <button className="btn btn-green" onClick={handleSave}>💾 Save changes</button>
              <button className="btn btn-outline" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="danger-zone">
          <div className="danger-title">⚠️ Danger zone</div>
          <p className="danger-desc">Permanently delete your account and all associated data. This action cannot be undone.</p>
          <button className="btn btn-danger">Delete account</button>
        </div>
      </div>
    </>
  )
}
