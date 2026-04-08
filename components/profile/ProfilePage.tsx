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

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from('profiles').upsert({ id: user.id, ...form });
    setProfile((prev) => ({ ...prev!, ...form }));
    setEditing(false);
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <h3>Sign in to view your profile</h3>
        <a href="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>Sign In</a>
      </div>
    );
  }

  return (
    <main className="page-wrapper">
      <div className="container" style={{ maxWidth: 720, paddingTop: '2rem', paddingBottom: '4rem' }}>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="avatar-placeholder avatar-xl" style={{ fontSize: '2rem' }}>
            {profile?.full_name?.[0] ?? user.email?.[0] ?? '?'}
          </div>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              {profile?.full_name ?? user.email ?? 'Member'}
            </h1>
            {profile?.location && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>📍 {profile.location}</p>
            )}
            {profile?.trust_score !== undefined && (
              <span className="badge badge-primary" style={{ marginTop: '0.5rem' }}>
                Trust Score: {profile.trust_score}
              </span>
            )}
          </div>
          <button
            className="btn btn-outline btn-sm"
            style={{ marginLeft: 'auto' }}
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Cancel' : '✏️ Edit'}
          </button>
        </div>

        {/* Edit form */}
        {editing ? (
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Edit Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { label: 'Full Name', key: 'full_name', placeholder: 'Your name' },
                { label: 'Bio', key: 'bio', placeholder: 'Tell the community about yourself' },
                { label: 'Location', key: 'location', placeholder: 'City, Country' },
                { label: 'Website', key: 'website', placeholder: 'https://yoursite.com' },
              ].map(({ label, key, placeholder }) => (
                <div className="form-group" key={key}>
                  <label className="form-label">{label}</label>
                  <input
                    className="form-input"
                    placeholder={placeholder}
                    value={form[key as keyof typeof form]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          /* Profile info */
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>About</h3>
            <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7 }}>
              {profile?.bio ?? 'No bio yet. Click Edit to add one.'}
            </p>
            {profile?.website && (
              <a
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', marginTop: '0.75rem', color: 'var(--color-primary)' }}
              >
                🔗 {profile.website}
              </a>
            )}
          </div>
        )}

        {/* Account info */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Account</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <span>📧 {user.email}</span>
            <span>🗓️ Joined {new Date(user.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
            <span>✅ Email {user.email_confirmed_at ? 'verified' : 'not verified'}</span>
          </div>
        </div>

      </div>
    </main>
  );
}
