'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name?: string;
  username?: string;
  bio?: string;
  avatar_url?: string;
  location?: string;
  website?: string;
  trust_score?: number;
  created_at?: string;
}

interface TrustData {
  balance: number;
  lifetime: number;
}

function getTrustLevel(balance: number): { label: string; color: string; next: string; nextAt: number } {
  if (balance >= 1000) return { label: 'Elite', color: '#fbbf24', next: 'Max level', nextAt: 1000 };
  if (balance >= 500) return { label: 'Verified', color: '#34d399', next: 'Elite at ₮1000', nextAt: 1000 };
  if (balance >= 100) return { label: 'Trusted', color: '#38bdf8', next: 'Verified at ₮500', nextAt: 500 };
  return { label: 'Newcomer', color: '#94a3b8', next: 'Trusted at ₮100', nextAt: 100 };
}

function getInitials(name?: string, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return 'ME';
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trustData, setTrustData] = useState<TrustData | null>(null);
  const [form, setForm] = useState({ full_name: '', bio: '', location: '', website: '' });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single()
          .then(({ data: prof }) => {
            if (prof) {
              setProfile(prof);
              setForm({
                full_name: prof.full_name ?? '',
                bio: prof.bio ?? '',
                location: prof.location ?? '',
                website: prof.website ?? '',
              });
            }
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/trust')
      .then(r => r.json())
      .then((data: TrustData) => setTrustData(data))
      .catch(() => {/* silently fail */});
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').upsert({ id: user.id, ...form });
    setProfile((prev) => ({ ...prev!, ...form }));
    setEditing(false);
    setSaving(false);
  };

  const trustBalance = trustData?.balance ?? 0;
  const trustLifetime = trustData?.lifetime ?? 0;
  const trustLevel = getTrustLevel(trustBalance);
  const initials = getInitials(profile?.full_name, user?.email);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#0f172a', color: '#f1f5f9' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Sign in to view your profile</h3>
        <a href="/login" style={{ marginTop: '1rem', background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>Sign In</a>
      </div>
    );
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .profile-inner { max-width: 720px; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
        .profile-header { display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; }
        .profile-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.25rem; }
        .profile-form-grid { display: flex; flex-direction: column; gap: 1rem; }
        .profile-trust-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
        .profile-input {
          width: 100%;
          background: rgba(15,23,42,0.7);
          border: 1px solid rgba(148,163,184,0.18);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 15px;
          color: #f1f5f9;
          outline: none;
          font-family: inherit;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .profile-input:focus { border-color: rgba(56,189,248,0.4); }
        .profile-label { font-size: 12px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }

        @media (max-width: 640px) {
          .profile-inner { padding: 1rem 1rem 3rem; }
          .profile-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
          .profile-header > div:last-child { width: 100%; }
          .profile-trust-row { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="profile-inner">
        {/* Avatar + name */}
        <div className="profile-header">
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', flexShrink: 0, border: '3px solid rgba(56,189,248,0.3)' }}>
            {initials}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              {profile?.full_name ?? user.email ?? 'Member'}
            </h1>
            {profile?.location && (
              <p style={{ color: '#64748b', fontSize: '0.88rem', marginBottom: '0.35rem' }}>📍 {profile.location}</p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `${trustLevel.color}18`, border: `1px solid ${trustLevel.color}40`, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, color: trustLevel.color }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: trustLevel.color, display: 'inline-block' }} />
                {trustLevel.label}
              </span>
              <span style={{ fontSize: '0.78rem', color: '#475569' }}>
                Joined {new Date(user.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
          <button
            style={{ flexShrink: 0, background: editing ? 'rgba(148,163,184,0.1)' : 'rgba(56,189,248,0.1)', border: `1px solid ${editing ? 'rgba(148,163,184,0.2)' : 'rgba(56,189,248,0.3)'}`, borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.82rem', fontWeight: 600, color: editing ? '#94a3b8' : '#38bdf8', cursor: 'pointer' }}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Cancel' : '✏️ Edit Profile'}
          </button>
        </div>

        {/* Trust Economy */}
        <div className="profile-card">
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', letterSpacing: '0.05em' }}>TRUST ECONOMY</div>
          <div className="profile-trust-row">
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Balance</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8' }}>₮{trustBalance.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Lifetime Earned</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#34d399' }}>₮{trustLifetime.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Level</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: trustLevel.color, marginBottom: '0.25rem' }}>{trustLevel.label}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>{trustLevel.next}</div>
              {trustBalance < 1000 && (
                <div style={{ marginTop: '0.5rem', height: 4, background: 'rgba(56,189,248,0.1)', borderRadius: 2 }}>
                  <div style={{ width: `${Math.min((trustBalance / trustLevel.nextAt) * 100, 100)}%`, height: '100%', background: `linear-gradient(90deg,#38bdf8,${trustLevel.color})`, borderRadius: 2 }} />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="profile-card">
            <h3 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1rem' }}>Edit Profile</h3>
            <div className="profile-form-grid">
              {[
                { label: 'Full Name', key: 'full_name', placeholder: 'Your name', type: 'text' },
                { label: 'Bio', key: 'bio', placeholder: 'Tell the community about yourself', type: 'text' },
                { label: 'Location', key: 'location', placeholder: 'City, Country', type: 'text' },
                { label: 'Website', key: 'website', placeholder: 'https://yoursite.com', type: 'url' },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key}>
                  <label className="profile-label">{label}</label>
                  <input
                    className="profile-input"
                    type={type}
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.7rem', fontSize: '0.9rem', fontWeight: 700, color: '#0f172a', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* Profile info */
          <div className="profile-card">
            <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>About</h3>
            <p style={{ color: '#64748b', lineHeight: 1.7, fontSize: '0.9rem' }}>
              {profile?.bio ?? 'No bio yet. Click Edit Profile to add one.'}
            </p>
            {profile?.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '0.75rem', color: '#38bdf8', fontSize: '0.88rem', textDecoration: 'none' }}
              >
                🔗 {profile.website}
              </a>
            )}
          </div>
        )}

        {/* Account info */}
        <div className="profile-card">
          <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>Account</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem', color: '#64748b' }}>
            <span>📧 {user.email}</span>
            <span>🗓️ Joined {new Date(user.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
            <span>✅ Email {user.email_confirmed_at ? 'verified' : 'not verified'}</span>
          </div>
        </div>

      </div>
    </div>
  );
}
