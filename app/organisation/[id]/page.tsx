'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface OrgMember {
  id: string
  name: string
  role: string
  avatar_url?: string
  linkedin_url?: string
}

interface OrgReview {
  id: string
  reviewer_name?: string
  reviewer_avatar?: string
  rating: number
  title?: string
  body: string
  verified: boolean
  created_at: string
}

interface OrgListing {
  id: string
  title: string
  description: string
  price?: number
  currency?: string
  images?: string[]
}

interface Organisation {
  id: string
  name: string
  slug: string
  type: string
  description?: string
  mission?: string
  logo_url?: string
  cover_url?: string
  location?: string
  website?: string
  founded_year?: number
  verified: boolean
  follower_count: number
  member_count: number
  trust_score: number
  sdg_goals?: number[]
}

const SDG_LABELS: Record<number, string> = {
  1: 'No Poverty', 2: 'Zero Hunger', 3: 'Good Health', 4: 'Quality Education',
  5: 'Gender Equality', 6: 'Clean Water', 7: 'Clean Energy', 8: 'Decent Work',
  9: 'Industry & Innovation', 10: 'Reduced Inequalities', 11: 'Sustainable Cities',
  12: 'Responsible Consumption', 13: 'Climate Action', 14: 'Life Below Water',
  15: 'Life on Land', 16: 'Peace & Justice', 17: 'Partnerships',
}

const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d', 5: '#ff3a21',
  6: '#26bde2', 7: '#fcc30b', 8: '#a21942', 9: '#fd6925', 10: '#dd1367',
  11: '#fd9d24', 12: '#bf8b2e', 13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b',
  16: '#00689d', 17: '#19486a',
}

// Mock fallback for when org ID doesn't exist in DB yet
const MOCK_ORG: Organisation = {
  id: '1',
  name: 'GreenFuture Initiative',
  slug: 'greenfuture-initiative',
  type: 'Social Enterprise',
  description: 'GreenFuture Initiative is a leading social enterprise dedicated to creating sustainable solutions for communities. We work at the intersection of environmental sustainability, social impact, and economic opportunity.',
  mission: 'To accelerate the transition to a sustainable, equitable economy by connecting people, businesses, and communities with the tools, knowledge, and resources they need to thrive in a net-zero world.',
  location: 'London, United Kingdom',
  website: 'https://greenfuture.org',
  founded_year: 2018,
  verified: true,
  follower_count: 3842,
  member_count: 247,
  trust_score: 94,
  sdg_goals: [4, 7, 13, 15, 17],
}

const MOCK_MEMBERS: OrgMember[] = [
  { id: 't1', name: 'Sarah Okonkwo', role: 'Chief Executive Officer', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=SO&backgroundColor=0ea5e9' },
  { id: 't2', name: 'James Whitfield', role: 'Head of Sustainability', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=JW&backgroundColor=8b5cf6' },
  { id: 't3', name: 'Priya Sharma', role: 'Community Lead', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=PS&backgroundColor=ec4899' },
  { id: 't4', name: 'Tom Adeyemi', role: 'Head of Partnerships', avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=TA&backgroundColor=f59e0b' },
]

const MOCK_REVIEWS: OrgReview[] = [
  { id: 'r1', reviewer_name: 'Claire Hutchinson', rating: 5, title: 'Transformed our sustainability strategy', body: 'GreenFuture delivered an outstanding sustainability audit. Their team was thorough, professional, and genuinely passionate. The roadmap they produced has already saved us 18% on energy costs.', verified: true, created_at: '2024-03-15' },
  { id: 'r2', reviewer_name: 'Marcus Bell', rating: 5, title: 'Incredible community grant support', body: 'The grant programme was a lifeline for our local environmental project. The application process was straightforward and the team were supportive throughout.', verified: true, created_at: '2024-02-28' },
  { id: 'r3', reviewer_name: 'Fatima Al-Rashid', rating: 4, title: 'Great training programme', body: 'The Green Skills workshop was well-structured and informative. Would have given 5 stars but the online materials could be improved. Overall a really valuable experience.', verified: true, created_at: '2024-01-10' },
]

const MOCK_LISTINGS: OrgListing[] = [
  { id: 'l1', title: 'Sustainability Auditing', description: 'Comprehensive audits of your environmental impact with actionable improvement plans.', price: 1200 },
  { id: 'l2', title: 'Net Zero Strategy', description: 'End-to-end strategy development to help your business achieve net zero emissions.', price: 3500 },
  { id: 'l3', title: 'Green Skills Training', description: 'Workshops and certifications for individuals seeking careers in the green economy.', price: 150 },
]

type Tab = 'about' | 'services' | 'products' | 'events' | 'team' | 'reviews'

function getInitials(name: string) {
  return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i < rating ? '#fbbf24' : 'none'} stroke="#fbbf24" strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
        </svg>
      ))}
    </span>
  )
}

export default function OrganisationPage({ params }: { params: { id: string } }) {
  const [org, setOrg] = useState<Organisation | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [reviews, setReviews] = useState<OrgReview[]>([])
  const [services, setServices] = useState<OrgListing[]>([])
  const [products, setProducts] = useState<OrgListing[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('about')
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)

  useEffect(() => {
    async function load() {
      try {
        // Try to fetch from API
        const res = await fetch(`/api/organisations/${params.id}`)
        if (res.ok) {
          const data = await res.json()
          setOrg(data.org ?? MOCK_ORG)
          setMembers(data.members ?? MOCK_MEMBERS)
          setReviews(data.reviews ?? MOCK_REVIEWS)
          setServices(data.services ?? MOCK_LISTINGS)
          setProducts(data.products ?? [])
          setFollowerCount(data.org?.follower_count ?? MOCK_ORG.follower_count)
        } else {
          throw new Error('Not found')
        }
      } catch {
        // Fall back to mock
        setOrg(MOCK_ORG)
        setMembers(MOCK_MEMBERS)
        setReviews(MOCK_REVIEWS)
        setServices(MOCK_LISTINGS)
        setProducts([])
        setFollowerCount(MOCK_ORG.follower_count)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  const handleFollow = async () => {
    setFollowing(f => !f)
    setFollowerCount(c => following ? c - 1 : c + 1)
    try {
      await fetch(`/api/organisations/${params.id}/follow`, { method: 'POST' })
    } catch {}
  }

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
  const ratingBreakdown = [5, 4, 3, 2, 1].map(n => ({
    star: n,
    count: reviews.filter(r => r.rating === n).length,
  }))

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'about', label: 'About' },
    { id: 'services', label: 'Services', count: services.length },
    { id: 'products', label: 'Products', count: products.length },
    { id: 'events', label: 'Events' },
    { id: 'team', label: 'Team', count: members.length },
    { id: 'reviews', label: 'Reviews', count: reviews.length },
  ]

  if (loading) {
    return (
      <>
        <style>{orgStyles}</style>
        <div className="op-page">
          <div className="op-skeleton-cover" />
          <div className="op-container">
            <div className="op-skeleton-header" />
            <div className="op-skeleton-body" />
          </div>
        </div>
      </>
    )
  }

  if (!org) return null

  return (
    <>
      <style>{orgStyles}</style>
      <div className="op-page">
        {/* Cover */}
        <div
          className="op-cover"
          style={{
            background: org.cover_url
              ? `url(${org.cover_url}) center/cover no-repeat`
              : 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)',
          }}
        >
          <div className="op-cover-overlay" />
        </div>

        <div className="op-container">
          {/* Logo + Header */}
          <div className="op-header">
            <div className="op-logo-wrap">
              {org.logo_url ? (
                <img src={org.logo_url} alt={org.name} className="op-logo" />
              ) : (
                <div className="op-logo op-logo-fallback">
                  {getInitials(org.name)}
                </div>
              )}
              {org.verified && (
                <span className="op-verified-badge" title="Verified Organisation">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#38bdf8">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#38bdf8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </div>

            <div className="op-header-info">
              <div className="op-name-row">
                <h1 className="op-name">{org.name}</h1>
                <span className="op-type-badge">{org.type}</span>
              </div>
              <div className="op-meta-row">
                {org.location && (
                  <span className="op-meta-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {org.location}
                  </span>
                )}
                {org.founded_year && (
                  <span className="op-meta-item">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Est. {org.founded_year}
                  </span>
                )}
                {org.website && (
                  <a href={org.website} target="_blank" rel="noopener noreferrer" className="op-meta-item op-meta-link">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    Website
                  </a>
                )}
              </div>
            </div>

            <div className="op-follow-wrap">
              <button
                onClick={handleFollow}
                className={`op-follow-btn${following ? ' op-follow-btn--following' : ''}`}
              >
                {following ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="15" y1="3" x2="19" y2="7"/></svg>
                    Following
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><line x1="17" y1="10" x2="17" y2="16"/><line x1="14" y1="13" x2="20" y2="13"/></svg>
                    Follow
                  </>
                )}
              </button>
              <span className="op-follower-count">
                <strong>{followerCount.toLocaleString()}</strong> followers
              </span>
            </div>
          </div>

          {/* Stats bar */}
          <div className="op-stats">
            {[
              { label: 'Members', value: org.member_count.toLocaleString(), icon: '👥' },
              { label: 'Services', value: services.length.toString(), icon: '🔧' },
              { label: 'Trust Score', value: `${org.trust_score}%`, icon: '₮' },
              { label: 'Reviews', value: reviews.length.toString(), icon: '⭐' },
            ].map(s => (
              <div key={s.label} className="op-stat">
                <span className="op-stat-icon">{s.icon}</span>
                <span className="op-stat-value">{s.value}</span>
                <span className="op-stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="op-tabs">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`op-tab${activeTab === tab.id ? ' op-tab--active' : ''}`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="op-tab-count">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="op-tab-body">
            {/* About */}
            {activeTab === 'about' && (
              <div className="op-about">
                <div className="op-card">
                  <h2 className="op-card-title">About</h2>
                  <p className="op-text">{org.description}</p>
                </div>
                {org.mission && (
                  <div className="op-card">
                    <h2 className="op-card-title">Our Mission</h2>
                    <blockquote className="op-mission">{org.mission}</blockquote>
                  </div>
                )}
                {org.sdg_goals && org.sdg_goals.length > 0 && (
                  <div className="op-card">
                    <h2 className="op-card-title">UN Sustainable Development Goals</h2>
                    <div className="op-sdgs">
                      {org.sdg_goals.map(n => (
                        <span
                          key={n}
                          className="op-sdg"
                          style={{ background: SDG_COLORS[n] ?? '#38bdf8' }}
                          title={SDG_LABELS[n]}
                        >
                          SDG {n}: {SDG_LABELS[n]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="op-card">
                  <h2 className="op-card-title">Contact</h2>
                  <div className="op-contact-grid">
                    {org.location && (
                      <div className="op-contact-item">
                        <span className="op-contact-label">Location</span>
                        <span className="op-contact-value">{org.location}</span>
                      </div>
                    )}
                    {org.website && (
                      <div className="op-contact-item">
                        <span className="op-contact-label">Website</span>
                        <a href={org.website} target="_blank" rel="noopener noreferrer" className="op-contact-link">{org.website.replace(/^https?:\/\//, '')}</a>
                      </div>
                    )}
                    {org.founded_year && (
                      <div className="op-contact-item">
                        <span className="op-contact-label">Founded</span>
                        <span className="op-contact-value">{org.founded_year}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Services */}
            {activeTab === 'services' && (
              <div className="op-listings-grid">
                {services.length === 0 ? (
                  <div className="op-empty">
                    <span>🔧</span>
                    <p>No services listed yet.</p>
                  </div>
                ) : services.map(s => (
                  <Link key={s.id} href={`/services/${s.id}`} className="op-listing-card">
                    {s.images?.[0] && <img src={s.images[0]} alt={s.title} className="op-listing-img" />}
                    {!s.images?.[0] && (
                      <div className="op-listing-img op-listing-img-placeholder">🔧</div>
                    )}
                    <div className="op-listing-body">
                      <h3 className="op-listing-title">{s.title}</h3>
                      <p className="op-listing-desc">{s.description}</p>
                      {s.price !== undefined && (
                        <span className="op-listing-price">From £{s.price.toLocaleString()}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Products */}
            {activeTab === 'products' && (
              <div className="op-listings-grid">
                {products.length === 0 ? (
                  <div className="op-empty">
                    <span>📦</span>
                    <p>No products listed yet.</p>
                  </div>
                ) : products.map(p => (
                  <Link key={p.id} href={`/products/${p.id}`} className="op-listing-card">
                    {p.images?.[0] && <img src={p.images[0]} alt={p.title} className="op-listing-img" />}
                    {!p.images?.[0] && (
                      <div className="op-listing-img op-listing-img-placeholder">📦</div>
                    )}
                    <div className="op-listing-body">
                      <h3 className="op-listing-title">{p.title}</h3>
                      <p className="op-listing-desc">{p.description}</p>
                      {p.price !== undefined && (
                        <span className="op-listing-price">£{p.price.toLocaleString()}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Events */}
            {activeTab === 'events' && (
              <div className="op-empty">
                <span>📅</span>
                <p>No upcoming events.</p>
                <Link href="/events" className="op-empty-link">Browse all events →</Link>
              </div>
            )}

            {/* Team */}
            {activeTab === 'team' && (
              <div className="op-team-grid">
                {members.length === 0 ? (
                  <div className="op-empty"><span>👥</span><p>No team members listed.</p></div>
                ) : members.map(m => (
                  <div key={m.id} className="op-team-card">
                    {m.avatar_url ? (
                      <img src={m.avatar_url} alt={m.name} className="op-team-avatar" />
                    ) : (
                      <div className="op-team-avatar op-team-avatar-fallback">{getInitials(m.name)}</div>
                    )}
                    <div className="op-team-info">
                      <span className="op-team-name">{m.name}</span>
                      <span className="op-team-role">{m.role}</span>
                      {m.linkedin_url && (
                        <a href={m.linkedin_url} target="_blank" rel="noopener noreferrer" className="op-team-linkedin">
                          LinkedIn →
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Reviews */}
            {activeTab === 'reviews' && (
              <div className="op-reviews">
                {reviews.length > 0 && (
                  <div className="op-rating-summary">
                    <div className="op-rating-big">
                      <span className="op-rating-num">{avgRating.toFixed(1)}</span>
                      <StarRating rating={Math.round(avgRating)} />
                      <span className="op-rating-total">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="op-rating-bars">
                      {ratingBreakdown.map(({ star, count }) => (
                        <div key={star} className="op-rating-bar-row">
                          <span className="op-rating-bar-label">{star}★</span>
                          <div className="op-rating-bar-track">
                            <div
                              className="op-rating-bar-fill"
                              style={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                            />
                          </div>
                          <span className="op-rating-bar-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="op-reviews-list">
                  {reviews.length === 0 ? (
                    <div className="op-empty"><span>⭐</span><p>No reviews yet.</p></div>
                  ) : reviews.map(r => (
                    <div key={r.id} className="op-review-card">
                      <div className="op-review-header">
                        <div className="op-review-avatar">
                          {r.reviewer_avatar ? (
                            <img src={r.reviewer_avatar} alt={r.reviewer_name ?? ''} className="op-review-avatar-img" />
                          ) : (
                            <div className="op-review-avatar-fallback">{getInitials(r.reviewer_name ?? 'AN')}</div>
                          )}
                        </div>
                        <div className="op-review-meta">
                          <span className="op-review-name">{r.reviewer_name ?? 'Anonymous'}</span>
                          <div className="op-review-stars-row">
                            <StarRating rating={r.rating} />
                            {r.verified && <span className="op-review-verified">✓ Verified</span>}
                          </div>
                        </div>
                        <span className="op-review-date">{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                      {r.title && <h4 className="op-review-title">{r.title}</h4>}
                      <p className="op-review-body">{r.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

const orgStyles = `
  .op-page { min-height: 100vh; background: #0f172a; color: #f1f5f9; }

  /* Cover */
  .op-cover { height: 220px; position: relative; background: linear-gradient(135deg,#0f172a,#1e3a5f); }
  .op-cover-overlay { position: absolute; inset: 0; background: rgba(15,23,42,0.5); }
  @media (max-width: 600px) { .op-cover { height: 140px; } }

  /* Container */
  .op-container { max-width: 1100px; margin: 0 auto; padding: 0 1.25rem 4rem; }

  /* Header */
  .op-header { display: flex; align-items: flex-end; gap: 1.25rem; margin-top: -56px; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .op-logo-wrap { position: relative; flex-shrink: 0; }
  .op-logo { width: 100px; height: 100px; border-radius: 16px; border: 3px solid #1e293b; object-fit: cover; background: #1e293b; }
  .op-logo-fallback { display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: 900; color: #38bdf8; background: linear-gradient(135deg,#1e293b,#0f172a); }
  .op-verified-badge { position: absolute; bottom: 4px; right: 4px; background: #0f172a; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border: 2px solid #38bdf8; }
  .op-header-info { flex: 1; min-width: 200px; padding-bottom: 0.5rem; }
  .op-name-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
  .op-name { font-size: clamp(1.25rem, 3vw, 1.75rem); font-weight: 900; color: #f1f5f9; margin: 0; }
  .op-type-badge { background: rgba(56,189,248,0.12); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); border-radius: 999px; padding: 0.15rem 0.65rem; font-size: 0.78rem; font-weight: 700; white-space: nowrap; }
  .op-meta-row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
  .op-meta-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; color: #94a3b8; }
  .op-meta-link { color: #38bdf8; text-decoration: none; }
  .op-meta-link:hover { text-decoration: underline; }
  .op-follow-wrap { display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem; padding-bottom: 0.5rem; }
  .op-follow-btn { display: flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.25rem; border-radius: 10px; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.15s; border: 2px solid #38bdf8; background: #38bdf8; color: #0f172a; }
  .op-follow-btn--following { background: transparent; color: #38bdf8; }
  .op-follow-btn:hover { opacity: 0.88; }
  .op-follower-count { font-size: 0.8rem; color: #64748b; }
  .op-follower-count strong { color: #f1f5f9; }

  /* Stats */
  .op-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 0.75rem; margin-bottom: 1.5rem; }
  @media (max-width: 600px) { .op-stats { grid-template-columns: repeat(2,1fr); } }
  .op-stat { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 1rem; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; }
  .op-stat-icon { font-size: 1.25rem; }
  .op-stat-value { font-size: 1.3rem; font-weight: 900; color: #38bdf8; }
  .op-stat-label { font-size: 0.75rem; color: #64748b; font-weight: 500; }

  /* Tabs */
  .op-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid rgba(56,189,248,0.1); margin-bottom: 1.5rem; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
  .op-tabs::-webkit-scrollbar { display: none; }
  .op-tab { padding: 0.7rem 1rem; background: none; border: none; border-bottom: 2px solid transparent; cursor: pointer; font-size: 0.875rem; font-weight: 500; color: #64748b; white-space: nowrap; display: flex; align-items: center; gap: 0.4rem; transition: all 0.15s; }
  .op-tab:hover { color: #f1f5f9; }
  .op-tab--active { color: #38bdf8; border-bottom-color: #38bdf8; font-weight: 700; }
  .op-tab-count { background: rgba(56,189,248,0.12); color: #38bdf8; border-radius: 999px; padding: 0.05rem 0.45rem; font-size: 0.72rem; font-weight: 700; }

  /* Tab body */
  .op-tab-body { }
  .op-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
  .op-card-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; margin: 0 0 0.75rem; }
  .op-text { color: #94a3b8; font-size: 0.9375rem; line-height: 1.7; margin: 0; }
  .op-mission { border-left: 3px solid #38bdf8; padding-left: 1rem; margin: 0; color: #94a3b8; font-style: italic; line-height: 1.7; }
  .op-about { display: flex; flex-direction: column; gap: 0; }
  .op-sdgs { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .op-sdg { padding: 0.3rem 0.7rem; border-radius: 6px; font-size: 0.75rem; font-weight: 700; color: #fff; }
  .op-contact-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
  .op-contact-item { display: flex; flex-direction: column; gap: 0.2rem; }
  .op-contact-label { font-size: 0.72rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
  .op-contact-value { font-size: 0.9rem; color: #f1f5f9; }
  .op-contact-link { font-size: 0.9rem; color: #38bdf8; text-decoration: none; }
  .op-contact-link:hover { text-decoration: underline; }

  /* Listings grid */
  .op-listings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .op-listing-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; overflow: hidden; text-decoration: none; color: #f1f5f9; transition: all 0.15s; display: flex; flex-direction: column; }
  .op-listing-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-2px); }
  .op-listing-img { width: 100%; height: 160px; object-fit: cover; }
  .op-listing-img-placeholder { background: rgba(56,189,248,0.08); display: flex; align-items: center; justify-content: center; font-size: 2rem; }
  .op-listing-body { padding: 1rem; flex: 1; display: flex; flex-direction: column; gap: 0.4rem; }
  .op-listing-title { font-size: 0.9375rem; font-weight: 700; color: #f1f5f9; margin: 0; }
  .op-listing-desc { font-size: 0.85rem; color: #94a3b8; margin: 0; flex: 1; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .op-listing-price { font-size: 0.875rem; font-weight: 700; color: #34d399; }

  /* Team */
  .op-team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
  .op-team-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }
  .op-team-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(56,189,248,0.2); }
  .op-team-avatar-fallback { background: linear-gradient(135deg,#38bdf8,#0284c7); color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; font-weight: 700; }
  .op-team-info { display: flex; flex-direction: column; gap: 0.2rem; align-items: center; }
  .op-team-name { font-size: 0.9rem; font-weight: 700; color: #f1f5f9; }
  .op-team-role { font-size: 0.78rem; color: #64748b; }
  .op-team-linkedin { font-size: 0.78rem; color: #38bdf8; text-decoration: none; }
  .op-team-linkedin:hover { text-decoration: underline; }

  /* Reviews */
  .op-rating-summary { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; display: flex; gap: 2rem; align-items: center; flex-wrap: wrap; }
  .op-rating-big { display: flex; flex-direction: column; align-items: center; gap: 0.4rem; min-width: 100px; }
  .op-rating-num { font-size: 2.5rem; font-weight: 900; color: #fbbf24; line-height: 1; }
  .op-rating-total { font-size: 0.78rem; color: #64748b; }
  .op-rating-bars { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 0.4rem; }
  .op-rating-bar-row { display: flex; align-items: center; gap: 0.6rem; font-size: 0.78rem; }
  .op-rating-bar-label { color: #64748b; width: 22px; text-align: right; flex-shrink: 0; }
  .op-rating-bar-track { flex: 1; height: 8px; background: rgba(56,189,248,0.08); border-radius: 4px; overflow: hidden; }
  .op-rating-bar-fill { height: 100%; background: #fbbf24; border-radius: 4px; transition: width 0.4s; }
  .op-rating-bar-count { color: #64748b; width: 20px; flex-shrink: 0; }
  .op-reviews-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .op-review-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; padding: 1.25rem; }
  .op-review-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.6rem; }
  .op-review-avatar { flex-shrink: 0; }
  .op-review-avatar-img { width: 38px; height: 38px; border-radius: 50%; object-fit: cover; }
  .op-review-avatar-fallback { width: 38px; height: 38px; border-radius: 50%; background: linear-gradient(135deg,#38bdf8,#0284c7); color: #0f172a; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; }
  .op-review-meta { flex: 1; min-width: 0; }
  .op-review-name { display: block; font-size: 0.875rem; font-weight: 700; color: #f1f5f9; }
  .op-review-stars-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.15rem; }
  .op-review-verified { font-size: 0.72rem; color: #34d399; font-weight: 600; }
  .op-review-date { font-size: 0.78rem; color: #64748b; flex-shrink: 0; }
  .op-review-title { font-size: 0.9rem; font-weight: 700; color: #f1f5f9; margin: 0 0 0.4rem; }
  .op-review-body { font-size: 0.875rem; color: #94a3b8; line-height: 1.6; margin: 0; }

  /* Empty state */
  .op-empty { padding: 3rem; text-align: center; color: #64748b; }
  .op-empty span { font-size: 2.5rem; display: block; margin-bottom: 0.75rem; }
  .op-empty p { margin: 0; font-size: 0.9rem; }
  .op-empty-link { display: inline-block; margin-top: 0.75rem; color: #38bdf8; font-size: 0.875rem; text-decoration: none; }
  .op-empty-link:hover { text-decoration: underline; }

  /* Skeleton */
  .op-skeleton-cover { height: 220px; background: linear-gradient(135deg,#1e293b,#0f172a); }
  .op-skeleton-header { height: 120px; background: rgba(56,189,248,0.05); border-radius: 12px; margin: 1.5rem 0; animation: pulse 1.5s ease-in-out infinite; }
  .op-skeleton-body { height: 400px; background: rgba(56,189,248,0.04); border-radius: 12px; animation: pulse 1.5s ease-in-out infinite; }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
`
