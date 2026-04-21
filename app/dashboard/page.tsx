'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Avatar from '@/components/Avatar'
import { createClient } from '@/lib/supabase/client'

type Profile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  trust_balance: number | null
  follower_count: number | null
  avg_rating: number | null
  review_count: number | null
  account_type: string | null
}

type Stats = {
  listings: number
  orders: number
  reviews: number
  posts: number
}

const QUICK_LINKS = [
  { href: '/feed',       icon: '📰', label: 'Newsfeed'     },
  { href: '/services',   icon: '🛠',  label: 'Services'     },
  { href: '/products',   icon: '📦', label: 'Products'     },
  { href: '/jobs',       icon: '💼', label: 'Jobs'          },
  { href: '/events',     icon: '📅', label: 'Events'        },
  { href: '/community',  icon: '👥', label: 'Groups'       },
  { href: '/articles',   icon: '✍️', label: 'Articles'     },
  { href: '/browse',     icon: '🔍', label: 'Directory'    },
  { href: '/impact',     icon: '🌍', label: 'Impact'        },
  { href: '/wallet',     icon: '💎', label: 'Wallet'        },
  { href: '/analytics',  icon: '📊', label: 'Analytics'    },
  { href: '/settings',   icon: '⚙️', label: 'Settings'     },
]

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [stats,   setStats]   = useState<Stats>({ listings: 0, orders: 0, reviews: 0, posts: 0 })
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.user) { router.push('/auth/login'); return }
        const uid = session.user.id

        const [profileRes, balanceRes, listingsRes, ordersRes, reviewsRes, postsRes] = await Promise.all([
          supabase.from('profiles').select('id,full_name,username,avatar_url,bio,location,trust_balance,follower_count,avg_rating,review_count,account_type').eq('id', uid).maybeSingle(),
          supabase.from('trust_balances').select('balance').eq('user_id', uid).maybeSingle(),
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', uid),
          supabase.from('orders').select('id', { count: 'exact', head: true }).or(`buyer_id.eq.${uid},seller_id.eq.${uid}`),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).or(`reviewer_id.eq.${uid},reviewee_id.eq.${uid}`),
          supabase.from('feed_posts').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        ])

        setProfile(profileRes.data ?? null)
        setBalance(balanceRes.data?.balance ?? null)
        setStats({
          listings: listingsRes.count ?? 0,
          orders:   ordersRes.count   ?? 0,
          reviews:  reviewsRes.count  ?? 0,
          posts:    postsRes.count    ?? 0,
        })
      } catch { /* silent */ }
      finally { setLoading(false) }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '14px', color: '#64748b' }}>Loading…</div>
    </div>
  )

  const name = profile?.full_name ?? profile?.username ?? 'Welcome back'
  const trust = balance ?? profile?.trust_balance ?? 0

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .dash-grid { max-width: 860px; margin: 0 auto; padding: 1.5rem; }
        .stat-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
        .quick-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.65rem; }
        @media (max-width: 600px) {
          .dash-grid { padding: 1rem; }
          .stat-row { grid-template-columns: repeat(2, 1fr); }
          .quick-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <div className="dash-grid">

        {/* ── Profile card ── */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', padding: '1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <Avatar url={profile?.avatar_url ?? null} name={profile?.full_name} size={60} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
            {profile?.username && <div style={{ fontSize: '13px', color: '#64748b' }}>@{profile.username}</div>}
            {profile?.location && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>📍 {profile.location}</div>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
            <div style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '10px', padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8' }}>₮{trust.toFixed(0)}</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>TRUST</div>
            </div>
            <Link href="/profile" style={{ fontSize: '12px', color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>Edit profile →</Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="stat-row">
          {[
            { label: 'Listings',   value: stats.listings, icon: '🛍️', href: '/profile' },
            { label: 'Orders',     value: stats.orders,   icon: '📦', href: '/orders'  },
            { label: 'Reviews',    value: stats.reviews,  icon: '⭐', href: '/profile' },
            { label: 'Posts',      value: stats.posts,    icon: '✍️', href: '/feed'    },
          ].map(s => (
            <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '0.85rem', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: '22px', marginBottom: '4px' }}>{s.icon}</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#f1f5f9' }}>{s.value}</div>
                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{s.label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Quick actions ── */}
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>Quick access</div>
        <div className="quick-grid" style={{ marginBottom: '1.5rem' }}>
          {QUICK_LINKS.map(({ href, icon, label }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '0.75rem 0.5rem', textAlign: 'center', cursor: 'pointer' }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{icon}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 500 }}>{label}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── CTA cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <Link href="/create" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(56,189,248,0.04))', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '12px', padding: '1rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>✏️</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Create a post</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Share with the community</div>
            </div>
          </Link>
          <Link href="/seller/gigs/create" style={{ textDecoration: 'none' }}>
            <div style={{ background: 'linear-gradient(135deg, rgba(52,211,153,0.1), rgba(52,211,153,0.03))', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '12px', padding: '1rem', cursor: 'pointer' }}>
              <div style={{ fontSize: '22px', marginBottom: '6px' }}>🛠</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>List a service</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Start earning Trust</div>
            </div>
          </Link>
        </div>

      </div>
    </div>
  )
}
