'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/Avatar'
import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  full_name?: string | null
  username?: string | null
  bio?: string | null
  avatar_url?: string | null
  cover_url?: string | null
  location?: string | null
  website?: string | null
  trust_balance?: number | null
  follower_count?: number | null
  following_count?: number | null
  created_at?: string | null
}

interface ActivityItem {
  id: string
  type: 'post' | 'article' | 'service' | 'product' | 'event' | 'community' | 'review' | 'milestone'
  title: string
  subtitle?: string
  href?: string
  created_at: string
  meta?: string
}

interface ServiceListing {
  id: string
  title: string
  description?: string | null
  price: number
  currency?: string | null
  service_mode?: string | null
  tags?: string[] | null
  avg_rating?: number | null
  review_count?: number | null
  created_at: string
}

function getTrustLevel(balance: number) {
  if (balance >= 5000) return { label: 'FreeTrust Ambassador', icon: '👑', color: '#f59e0b', nextAt: null,  next: 'Max level reached' }
  if (balance >= 1000) return { label: 'Community Leader',    icon: '🏆', color: '#a78bfa', nextAt: 5000, next: 'Ambassador at ₮5000' }
  if (balance >= 500)  return { label: 'Verified Member',     icon: '✅', color: '#34d399', nextAt: 1000, next: 'Leader at ₮1000' }
  if (balance >= 100)  return { label: 'Trusted Member',      icon: '⭐', color: '#38bdf8', nextAt: 500,  next: 'Verified at ₮500' }
  return                      { label: 'New Member',          icon: '🌱', color: '#94a3b8', nextAt: 100,  next: 'Trusted at ₮100' }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function calcCompleteness(profile: Profile | null, email: string | null): { pct: number; missing: string[] } {
  if (!profile) return { pct: 0, missing: ['Full name', 'Bio', 'Avatar', 'Location', 'Website'] }
  const checks = [
    { label: 'Full name', done: !!profile.full_name },
    { label: 'Bio', done: !!profile.bio },
    { label: 'Profile photo', done: !!profile.avatar_url },
    { label: 'Cover photo', done: !!profile.cover_url },
    { label: 'Location', done: !!profile.location },
    { label: 'Website', done: !!profile.website },
  ]
  const done = checks.filter(c => c.done).length
  const missing = checks.filter(c => !c.done).map(c => c.label)
  return { pct: Math.round((done / checks.length) * 100), missing }
}

export default function ProfilePage() {
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [trustBalance, setTrustBalance] = useState(0)
  const [form, setForm] = useState({ full_name: '', bio: '', location: '', website: '' })
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [coverUploading, setCoverUploading] = useState(false)
  const [coverHover, setCoverHover] = useState(false)
  const [avatarHover, setAvatarHover] = useState(false)
  const [activity, setActivity] = useState<ActivityItem[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [services, setServices] = useState<ServiceListing[]>([])
  const [showAllServices, setShowAllServices] = useState(false)
  const [bonusAwarded, setBonusAwarded] = useState(false)
  const [toast, setToast] = useState('')

  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3500)
  }

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (prof) {
        setProfile(prof)
        setForm({
          full_name: prof.full_name ?? '',
          bio: prof.bio ?? '',
          location: prof.location ?? '',
          website: prof.website ?? '',
        })
      }
    } catch (err) {
      console.error('loadProfile error:', err)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadTrust = useCallback(async () => {
    try {
      const res = await fetch('/api/trust')
      if (res.ok) {
        const data = await res.json() as { balance?: number }
        setTrustBalance(data.balance ?? 0)
      }
    } catch { /* silent */ }
  }, [])

  const loadServices = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, title, description, price, currency, service_mode, tags, avg_rating, review_count, created_at')
        .eq('seller_id', userId)
        .eq('product_type', 'service')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setServices(data ?? [])
    } catch (err) {
      console.error('loadServices error:', err)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadActivity = useCallback(async (userId: string) => {
    setLoadingActivity(true)
    try {
      const items: ActivityItem[] = []

      // Feed posts
      const { data: posts } = await supabase
        .from('feed_posts')
        .select('id, content, type, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (posts) {
        for (const p of posts) {
          items.push({
            id: `post-${p.id}`,
            type: 'post',
            title: (p.content as string | null)?.slice(0, 80) ?? 'Post',
            href: '/feed',
            created_at: p.created_at,
            meta: p.type,
          })
        }
      }

      // Articles
      const { data: articles } = await supabase
        .from('articles')
        .select('id, title, created_at')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (articles) {
        for (const a of articles) {
          items.push({
            id: `article-${a.id}`,
            type: 'article',
            title: a.title ?? 'Article',
            href: `/articles/${a.id}`,
            created_at: a.created_at,
          })
        }
      }

      // Services (product_type = 'service')
      const { data: serviceItems } = await supabase
        .from('listings')
        .select('id, title, created_at')
        .eq('seller_id', userId)
        .eq('product_type', 'service')
        .order('created_at', { ascending: false })
        .limit(2)
      if (serviceItems) {
        for (const s of serviceItems) {
          items.push({
            id: `service-${s.id}`,
            type: 'service',
            title: s.title ?? 'Service listing',
            href: `/services/${s.id}`,
            created_at: s.created_at,
          })
        }
      }

      // Products (product_type != 'service')
      const { data: productItems } = await supabase
        .from('listings')
        .select('id, title, created_at')
        .eq('seller_id', userId)
        .neq('product_type', 'service')
        .order('created_at', { ascending: false })
        .limit(2)
      if (productItems) {
        for (const p of productItems) {
          items.push({
            id: `product-${p.id}`,
            type: 'product',
            title: p.title ?? 'Product listing',
            href: `/services/${p.id}`,
            created_at: p.created_at,
          })
        }
      }

      // Events hosted
      const { data: events } = await supabase
        .from('events')
        .select('id, title, created_at')
        .eq('organiser_id', userId)
        .order('created_at', { ascending: false })
        .limit(2)
      if (events) {
        for (const e of events) {
          items.push({
            id: `event-${e.id}`,
            type: 'event',
            title: e.title ?? 'Event',
            href: `/events/${e.id}`,
            created_at: e.created_at,
          })
        }
      }

      // Communities joined
      const { data: memberships } = await supabase
        .from('community_members')
        .select('created_at, communities(id, name)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (memberships) {
        for (const m of memberships) {
          const comm = (m.communities as unknown as { id: string; name: string } | null)
          items.push({
            id: `community-${m.created_at}`,
            type: 'community',
            title: `Joined ${comm?.name ?? 'community'}`,
            href: comm?.id ? `/community/${comm.id}` : '/community',
            created_at: m.created_at,
          })
        }
      }

      // Reviews received
      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at')
        .eq('reviewee_id', userId)
        .order('created_at', { ascending: false })
        .limit(3)
      if (reviews) {
        for (const r of reviews) {
          items.push({
            id: `review-${r.id}`,
            type: 'review',
            title: `${r.rating}★ review received`,
            subtitle: (r.comment as string | null)?.slice(0, 60),
            created_at: r.created_at,
          })
        }
      }

      // Sort by date desc
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      setActivity(items)
    } catch (err) {
      console.error('loadActivity error:', err)
    } finally {
      setLoadingActivity(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: u } } = await supabase.auth.getUser()
        setUser(u)
        if (u) {
          await Promise.all([loadProfile(u.id), loadTrust(), loadActivity(u.id), loadServices(u.id)])
        }
      } catch (err) {
        console.error('init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Award ₮10 bonus when profile hits 100%
  useEffect(() => {
    const { pct } = calcCompleteness(profile, user?.email ?? null)
    if (pct === 100 && !bonusAwarded && user) {
      setBonusAwarded(true)
      ;(async () => {
        try {
          const r = await fetch('/api/trust/award', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 10, reason: 'Profile 100% complete' }),
          })
          if (r.ok) {
            showToast('🎉 +₮10 Trust awarded for completing your profile!')
            setTrustBalance(prev => prev + 10)
          }
        } catch { /* silent */ }
      })()
    }
  }, [profile, user, bonusAwarded])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name || null,
          bio: form.bio || null,
          location: form.location || null,
          website: form.website || null,
        })
        .eq('id', user.id)
      if (error) throw error
      setProfile(prev => ({ ...prev!, ...form }))
      setEditing(false)
      showToast('Profile saved!')
    } catch (err) {
      console.error('save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { url: string }
      setProfile(prev => ({ ...prev!, avatar_url: data.url }))
      showToast('Profile photo updated!')
    } catch (err) {
      console.error('avatar upload error:', err)
      showToast('Photo upload failed. Please try again.')
    } finally {
      setAvatarUploading(false)
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setCoverUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/cover', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json() as { url: string }
      setProfile(prev => ({ ...prev!, cover_url: data.url }))
      showToast('Cover photo updated!')
    } catch (err) {
      console.error('cover upload error:', err)
      showToast('Cover upload failed. Please try again.')
    } finally {
      setCoverUploading(false)
      if (coverInputRef.current) coverInputRef.current.value = ''
    }
  }

  const { pct: completeness, missing } = calcCompleteness(profile, user?.email ?? null)
  const trustLevel = getTrustLevel(trustBalance)

  const activityIcon: Record<string, string> = {
    post: '📝',
    article: '📰',
    service: '🛠',
    product: '📦',
    event: '📅',
    community: '🌍',
    review: '⭐',
    milestone: '🏆',
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(56,189,248,0.2)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: '#0f172a', color: '#f1f5f9', gap: '1rem' }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sign in to view your profile</h3>
        <Link href="/login" style={{ background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.4rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>Sign In</Link>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .profile-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 14px; padding: 1.5rem; margin-bottom: 1.25rem; }
        .profile-input { width: 100%; background: rgba(15,23,42,0.7); border: 1px solid rgba(148,163,184,0.18); border-radius: 8px; padding: 10px 12px; font-size: 15px; color: #f1f5f9; outline: none; font-family: inherit; box-sizing: border-box; }
        .profile-input:focus { border-color: rgba(56,189,248,0.4); }
        .profile-label { font-size: 12px; font-weight: 600; color: #64748b; display: block; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
        .cover-overlay { opacity: 0; transition: opacity 0.2s; }
        .cover-wrap:hover .cover-overlay { opacity: 1; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', top: 70, right: 20, background: '#1e293b', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '12px 20px', fontSize: '0.88rem', color: '#f1f5f9', zIndex: 1000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          {toast}
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={avatarInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
      <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleCoverUpload} />

      {/* Cover photo */}
      <div
        className="cover-wrap"
        style={{ position: 'relative', height: '220px', cursor: 'pointer', overflow: 'hidden' }}
        onClick={() => !coverUploading && coverInputRef.current?.click()}
        onMouseEnter={() => setCoverHover(true)}
        onMouseLeave={() => setCoverHover(false)}
      >
        {profile?.cover_url ? (
          <img src={profile.cover_url} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, rgba(56,189,248,0.15) 100%)' }} />
        )}
        {/* Upload overlay */}
        <div
          className="cover-overlay"
          style={{
            position: 'absolute', inset: 0,
            background: 'rgba(15,23,42,0.55)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', color: '#f1f5f9', fontSize: '0.9rem', fontWeight: 600,
          }}
        >
          {coverUploading ? (
            <div style={{ width: 24, height: 24, border: '2px solid rgba(56,189,248,0.3)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          ) : (
            <>📷 Change cover photo</>
          )}
        </div>
      </div>

      {/* Profile header */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          {/* Avatar — overlaps cover */}
          <div
            style={{ position: 'absolute', top: '-52px', left: 0, cursor: 'pointer' }}
            onMouseEnter={() => setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            onClick={() => !avatarUploading && avatarInputRef.current?.click()}
            title="Change profile photo"
          >
            <div style={{ position: 'relative', width: 96, height: 96 }}>
              <Avatar
                url={profile?.avatar_url}
                name={profile?.full_name}
                email={user.email}
                size={96}
              />
              {/* Ring */}
              <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '3px solid #0f172a', pointerEvents: 'none' }} />
              {/* Uploading */}
              {avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 20, height: 20, border: '2px solid rgba(56,189,248,0.3)', borderTopColor: '#38bdf8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}
              {/* Hover */}
              {avatarHover && !avatarUploading && (
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(15,23,42,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                  📷
                </div>
              )}
            </div>
          </div>

          {/* Edit button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem' }}>
            <button
              onClick={() => setEditing(!editing)}
              style={{ background: editing ? 'rgba(148,163,184,0.1)' : 'rgba(56,189,248,0.1)', border: `1px solid ${editing ? 'rgba(148,163,184,0.2)' : 'rgba(56,189,248,0.3)'}`, borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 600, color: editing ? '#94a3b8' : '#38bdf8', cursor: 'pointer' }}
            >
              {editing ? 'Cancel' : '✏️ Edit Profile'}
            </button>
          </div>

          {/* Name + meta — offset for avatar */}
          <div style={{ paddingTop: '2.5rem' }}>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '0.3rem' }}>
              {profile?.full_name ?? user.email ?? 'Member'}
            </h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.5rem' }}>
              {profile?.location && <span>📍 {profile.location}</span>}
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#38bdf8', textDecoration: 'none' }}>
                  🔗 {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span>🗓 Member since {new Date(user.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              <span><strong style={{ color: '#f1f5f9' }}>{profile?.follower_count ?? 0}</strong> followers</span>
              <span><strong style={{ color: '#f1f5f9' }}>{profile?.following_count ?? 0}</strong> following</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: `${trustLevel.color}18`, border: `1px solid ${trustLevel.color}40`, borderRadius: 999, padding: '0.15rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, color: trustLevel.color }}>
                {trustLevel.icon} {trustLevel.label}
              </span>
            </div>
          </div>
        </div>

        {/* Profile Completeness Bar */}
        {completeness < 100 && (
          <div className="profile-card" style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f1f5f9' }}>Profile completeness</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>{completeness}%</span>
            </div>
            <div style={{ height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, marginBottom: '0.75rem', overflow: 'hidden' }}>
              <div style={{ width: `${completeness}%`, height: '100%', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: 3, transition: 'width 0.5s ease' }} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Complete your profile to earn <strong style={{ color: '#38bdf8' }}>₮10 bonus</strong>. Missing:&nbsp;
              {missing.map((m, i) => (
                <span key={m}>
                  <span style={{ color: '#94a3b8' }}>{m}</span>
                  {i < missing.length - 1 && ', '}
                </span>
              ))}
            </div>
          </div>
        )}
        {completeness === 100 && (
          <div className="profile-card" style={{ marginBottom: '1.25rem', border: '1px solid rgba(56,189,248,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#f1f5f9' }}>Profile 100% complete!</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>You earned ₮10 Trust for completing your profile.</div>
              </div>
            </div>
          </div>
        )}

        {/* Trust Economy */}
        <div className="profile-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', letterSpacing: '0.06em' }}>TRUST ECONOMY</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Balance</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#38bdf8' }}>₮{trustBalance.toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.25rem' }}>Level</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: trustLevel.color }}>{trustLevel.label}</div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>{trustLevel.next}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '0.4rem' }}>Progress</div>
              {trustLevel.nextAt !== null && (
                <div style={{ height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((trustBalance / trustLevel.nextAt) * 100, 100)}%`, height: '100%', background: `linear-gradient(90deg,#38bdf8,${trustLevel.color})`, borderRadius: 3 }} />
                </div>
              )}
              <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.25rem' }}>{trustBalance}{trustLevel.nextAt !== null ? `/${trustLevel.nextAt}` : ' MAX'}</div>
            </div>
          </div>
        </div>

        {/* Edit form or About */}
        {editing ? (
          <div className="profile-card">
            <h3 style={{ marginBottom: '1rem', fontWeight: 700, fontSize: '1rem' }}>Edit Profile</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
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
        ) : profile?.bio ? (
          <div className="profile-card">
            <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>About</h3>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, fontSize: '0.9rem' }}>{profile.bio}</p>
          </div>
        ) : null}

        {/* Services Section */}
        {services.length > 0 && (
          <div className="profile-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.06em' }}>SERVICES ({services.length})</div>
              <Link href="/seller/gigs/create" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, padding: '0.25rem 0.6rem' }}>
                + Add Service
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {(showAllServices ? services : services.slice(0, 4)).map(svc => (
                <Link
                  key={svc.id}
                  href={`/services/${svc.id}`}
                  style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', textDecoration: 'none', background: 'rgba(15,23,42,0.5)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: 10, padding: '0.85rem 1rem', transition: 'border-color 0.15s' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '0.88rem', lineHeight: 1.4, marginBottom: '0.3rem' }}>
                      {svc.title}
                    </div>
                    {svc.description && (
                      <div style={{ color: '#64748b', fontSize: '0.75rem', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {svc.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      {svc.service_mode && (
                        <span style={{ fontSize: '0.68rem', color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 4, padding: '0.1rem 0.4rem' }}>
                          {svc.service_mode === 'online' ? '🌐 Online' : svc.service_mode === 'in-person' ? '📍 In-person' : '🔄 Hybrid'}
                        </span>
                      )}
                      {svc.avg_rating && svc.review_count ? (
                        <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>⭐ {Number(svc.avg_rating).toFixed(1)} ({svc.review_count})</span>
                      ) : null}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#34d399' }}>
                      €{Number(svc.price).toLocaleString('en-IE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            {services.length > 4 && (
              <button
                onClick={() => setShowAllServices(s => !s)}
                style={{ marginTop: '0.75rem', width: '100%', background: 'transparent', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.5rem', fontSize: '0.82rem', color: '#38bdf8', cursor: 'pointer' }}
              >
                {showAllServices ? 'Show less' : `Show all ${services.length} services`}
              </button>
            )}
          </div>
        )}

        {/* Activity Section */}
        <div className="profile-card">
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '1rem', letterSpacing: '0.06em' }}>RECENT ACTIVITY</div>
          {loadingActivity ? (
            <div style={{ color: '#64748b', fontSize: '0.88rem' }}>Loading activity…</div>
          ) : activity.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '0.88rem', textAlign: 'center', padding: '1rem 0' }}>
              No activity yet — start posting, listing services, or joining communities!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {activity.map(item => (
                <div key={item.id} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}>{activityIcon[item.type] ?? '•'}</span>
                  <div style={{ flex: 1 }}>
                    {item.href ? (
                      <Link href={item.href} style={{ color: '#f1f5f9', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500 }}>
                        {item.title}
                      </Link>
                    ) : (
                      <span style={{ color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 500 }}>{item.title}</span>
                    )}
                    {item.subtitle && <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '2px' }}>{item.subtitle}</div>}
                  </div>
                  <span style={{ color: '#475569', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeAgo(item.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account info */}
        <div className="profile-card">
          <h3 style={{ marginBottom: '0.75rem', fontWeight: 700, fontSize: '1rem' }}>Account</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.88rem', color: '#64748b' }}>
            <span>📧 {user.email}</span>
            <span>🗓️ Joined {new Date(user.created_at ?? '').toLocaleDateString('en-IE', { month: 'long', year: 'numeric' })}</span>
            <span>✅ Email {user.email_confirmed_at ? 'verified' : 'not verified'}</span>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link href="/settings" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '0.35rem 0.75rem' }}>
              ⚙️ Settings
            </Link>
            <Link href="/wallet" style={{ fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '0.35rem 0.75rem' }}>
              💎 Wallet
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
