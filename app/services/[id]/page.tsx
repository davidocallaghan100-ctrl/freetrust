import { Metadata } from 'next'
import Link from 'next/link'
import { ALL_CATEGORIES, DELIVERY_OPTIONS } from '@/lib/service-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

type Package = {
  id: 'basic' | 'standard' | 'premium'
  label: string
  price: number
  delivery: string
  revisions: number
  description: string
  features: string[]
}

type Review = {
  id: string
  author: string
  avatar: string | null
  country: string
  rating: number
  date: string
  body: string
  helpful: number
}

type ServiceDetail = {
  id: string
  title: string
  category: string
  categoryId: string
  rating: number
  reviewCount: number
  images: string[]
  mode: 'online' | 'offline' | 'both'
  location?: string
  distance?: number
  deliveryTypes?: string[]
  seller: {
    id: string
    name: string
    username: string
    avatar: string | null
    level: string
    location: string
    languages: string[]
    memberSince: string
    responseTime: string
    lastSeen: string
    bio: string
    skills: string[]
    totalOrders: number
    completionRate: number
  }
  packages: Package[]
  description: string
  faq: { q: string; a: string }[]
  tags: string[]
  reviews: Review[]
}

// ─── Mock ─────────────────────────────────────────────────────────────────────

const MOCK: Record<string, ServiceDetail> = {
  'svc-001': {
    id: 'svc-001',
    title: 'I will design a professional logo and brand identity for your business',
    category: 'Design & Creative',
    categoryId: 'design-creative',
    rating: 4.9,
    reviewCount: 342,
    images: [
      'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=800&q=80',
      'https://images.unsplash.com/photo-1558655146-364adaf1fcc9?w=800&q=80',
    ],
    mode: 'online',
    deliveryTypes: ['digital'],
    seller: {
      id: 'usr-101',
      name: 'Alex Morgan',
      username: 'alexdesigns',
      avatar: 'https://i.pravatar.cc/150?img=11',
      level: 'Top Rated Seller',
      location: 'United Kingdom',
      languages: ['English', 'French'],
      memberSince: 'January 2021',
      responseTime: '1 hour',
      lastSeen: 'Online',
      bio: 'Award-winning graphic designer with 8+ years of experience creating compelling visual identities for startups and Fortune 500 companies.',
      skills: ['Logo Design', 'Brand Identity', 'Figma', 'Typography'],
      totalOrders: 1204,
      completionRate: 99,
    },
    packages: [
      { id: 'basic',    label: 'Basic',    price: 49,  delivery: '3 days', revisions: 2,  description: 'Clean, simple logo', features: ['1 concept', 'PNG & SVG', '2 revisions', 'Commercial use'] },
      { id: 'standard', label: 'Standard', price: 99,  delivery: '5 days', revisions: 5,  description: 'Full brand kit', features: ['3 concepts', 'All formats', '5 revisions', 'Brand style guide', 'Social media kit'] },
      { id: 'premium',  label: 'Premium',  price: 199, delivery: '7 days', revisions: -1, description: 'Complete brand identity', features: ['5 concepts', 'All formats', 'Unlimited revisions', 'Full brand guide', 'Source files', 'Priority support'] },
    ],
    description: 'A professional, memorable logo crafted from scratch — no templates. Includes full commercial rights and all file formats.',
    faq: [
      { q: 'What do you need to get started?', a: 'Business name, industry, target audience, and any colour/style preferences. A brief questionnaire is sent after purchase.' },
      { q: 'Can I request changes after delivery?', a: 'Yes — revisions are included in every package. Unlimited on the Premium package.' },
      { q: 'Do I own the copyright?', a: 'Yes. Full commercial rights transfer to you upon delivery and payment.' },
    ],
    tags: ['logo design', 'brand identity', 'startup branding'],
    reviews: [
      { id: 'r1', author: 'Sarah K.', avatar: 'https://i.pravatar.cc/150?img=5', country: 'United States', rating: 5, date: '2024-05-12', body: 'Alex delivered exactly what I envisioned — and then some. Highly recommend!', helpful: 24 },
      { id: 'r2', author: 'James T.', avatar: 'https://i.pravatar.cc/150?img=8', country: 'Australia', rating: 5, date: '2024-04-28', body: 'Third time working with Alex and still blown away every time.', helpful: 17 },
    ],
  },
}

function getMock(id: string): ServiceDetail {
  return MOCK[id] ?? { ...MOCK['svc-001'], id }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const svc = getMock(params.id)
  return { title: `${svc.title} | FreeTrust`, description: svc.description.slice(0, 155) }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ color: n <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: '14px' }}>★</span>
      ))}
    </span>
  )
}

function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.33) + 'px', color: '#0f172a', flexShrink: 0 }}>{initials}</div>
}

const PKG_COLORS = { basic: '#3b82f6', standard: '#8b5cf6', premium: '#f59e0b' }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServiceDetailPage({ params }: { params: { id: string } }) {
  const svc = getMock(params.id)
  const catInfo = ALL_CATEGORIES.find(c => c.id === svc.categoryId)
  const deliveryLabels = svc.deliveryTypes
    ? svc.deliveryTypes.map(d => DELIVERY_OPTIONS.find(o => o.id === d)).filter(Boolean)
    : []

  const card: React.CSSProperties = { background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 16px 80px' }}>

        {/* Breadcrumb */}
        <nav style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link href="/services" style={{ color: '#64748b', textDecoration: 'none' }}>Services</Link>
          <span>›</span>
          {catInfo && <Link href={`/services?cat=${svc.categoryId}`} style={{ color: '#64748b', textDecoration: 'none' }}>{catInfo.label}</Link>}
          {catInfo && <span>›</span>}
          <span style={{ color: '#94a3b8' }}>{svc.title.slice(0, 50)}…</span>
        </nav>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

          {/* ── Left column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Title + rating */}
            <div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 10px', borderRadius: '20px' }}>{catInfo?.icon} {catInfo?.label ?? svc.category}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, background: svc.mode === 'online' ? 'rgba(56,189,248,0.08)' : 'rgba(52,211,153,0.08)', color: svc.mode === 'online' ? '#38bdf8' : '#34d399', padding: '3px 10px', borderRadius: '20px' }}>
                  {svc.mode === 'online' ? '💻 Online' : '📍 Local'}
                </span>
                {svc.location && <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 10px', borderRadius: '20px', background: '#1e293b' }}>📍 {svc.location}{svc.distance ? ` · ${svc.distance}km` : ''}</span>}
              </div>
              <h1 style={{ fontSize: '22px', fontWeight: 800, lineHeight: 1.3, margin: '0 0 10px' }}>{svc.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: '#94a3b8' }}>
                <Stars rating={svc.rating} />
                <strong style={{ color: '#fbbf24' }}>{svc.rating.toFixed(1)}</strong>
                <span>({svc.reviewCount} reviews)</span>
                <span>·</span>
                <span>{svc.seller.totalOrders.toLocaleString()} orders</span>
              </div>
            </div>

            {/* Cover image */}
            {svc.images[0] && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #334155' }}>
                <img src={svc.images[0]} alt={svc.title} style={{ width: '100%', maxHeight: '380px', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Delivery types */}
            {deliveryLabels.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>Delivery Options</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {deliveryLabels.map(d => d && (
                    <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px', fontSize: '12px', color: '#94a3b8' }}>
                      {d.icon} {d.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>About This Service</div>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{svc.description}</p>
            </div>

            {/* Tags */}
            {svc.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {svc.tags.map(t => (
                  <span key={t} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid #334155', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#64748b' }}>#{t}</span>
                ))}
              </div>
            )}

            {/* FAQ */}
            {svc.faq.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>FAQs</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {svc.faq.map((f, i) => (
                    <div key={i}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>Q: {f.q}</div>
                      <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>{f.a}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {svc.reviews.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>
                  Reviews <span style={{ color: '#475569', fontWeight: 400 }}>({svc.reviewCount})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {svc.reviews.map(r => (
                    <div key={r.id} style={{ borderBottom: '1px solid #334155', paddingBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                        <Avatar url={r.avatar} name={r.author} size={36} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{r.author}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{r.country} · {new Date(r.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</div>
                        </div>
                        <div style={{ marginLeft: 'auto' }}><Stars rating={r.rating} /></div>
                      </div>
                      <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.6, margin: 0 }}>{r.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right column: Packages + Seller ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', position: 'sticky', top: '110px' }}>

            {/* Packages */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', overflow: 'hidden' }}>
              {/* Tab headers */}
              <div style={{ display: 'flex', borderBottom: '1px solid #334155' }}>
                {svc.packages.map((pkg, i) => (
                  <div key={pkg.id} style={{ flex: 1, padding: '10px 6px', textAlign: 'center', fontSize: '12px', fontWeight: 700, color: PKG_COLORS[pkg.id], borderBottom: i === 1 ? `2px solid ${PKG_COLORS[pkg.id]}` : 'none', cursor: 'pointer' }}>
                    {pkg.label}
                  </div>
                ))}
              </div>
              {/* Default show Standard (index 1) */}
              {svc.packages.slice(1, 2).map(pkg => (
                <div key={pkg.id} style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '28px', fontWeight: 800, color: '#f1f5f9' }}>£{pkg.price}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>/ project</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 12px', lineHeight: 1.5 }}>{pkg.description}</p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                    <span>⏱ {pkg.delivery}</span>
                    <span>🔄 {pkg.revisions < 0 ? 'Unlimited' : pkg.revisions} revision{pkg.revisions !== 1 ? 's' : ''}</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {pkg.features.map((f, i) => (
                      <li key={i} style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={`/checkout?service=${svc.id}&pkg=${pkg.id}`} style={{ display: 'block', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '10px', padding: '12px', textAlign: 'center', fontWeight: 700, fontSize: '14px', color: '#fff', textDecoration: 'none' }}>
                    Continue — £{pkg.price}
                  </Link>
                </div>
              ))}
              {/* All packages summary */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #334155', display: 'flex', gap: '8px' }}>
                {svc.packages.map(pkg => (
                  <div key={pkg.id} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: PKG_COLORS[pkg.id], textTransform: 'uppercase', letterSpacing: '0.04em' }}>{pkg.label}</div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>£{pkg.price}</div>
                    <div style={{ fontSize: '10px', color: '#475569' }}>{pkg.delivery}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Seller card */}
            <div style={card}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <Avatar url={svc.seller.avatar} name={svc.seller.name} size={52} />
                <div>
                  <Link href={`/profile/${svc.seller.username}`} style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' }}>{svc.seller.name}</Link>
                  <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>{svc.seller.level}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {svc.seller.location}</div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 12px' }}>{svc.seller.bio}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '12px' }}>
                {[
                  ['📦 Orders', svc.seller.totalOrders.toLocaleString()],
                  ['✅ Completion', `${svc.seller.completionRate}%`],
                  ['⚡ Response', svc.seller.responseTime],
                  ['🌐 Languages', svc.seller.languages.join(', ')],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: 'rgba(56,189,248,0.05)', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ color: '#475569', marginBottom: '2px' }}>{label}</div>
                    <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{val}</div>
                  </div>
                ))}
              </div>
              {svc.seller.skills.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {svc.seller.skills.map(s => (
                    <span key={s} style={{ fontSize: '10px', padding: '3px 8px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px', color: '#38bdf8' }}>{s}</span>
                  ))}
                </div>
              )}
              <Link href={`/profile/${svc.seller.username}`} style={{ display: 'block', marginTop: '14px', padding: '9px', textAlign: 'center', border: '1px solid #334155', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textDecoration: 'none' }}>
                View Profile
              </Link>
            </div>

            {/* Trust badge */}
            <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '12px 14px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>🛡️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '2px' }}>FreeTrust Guarantee</div>
                Your payment is held securely. Only released when you confirm delivery. If something goes wrong, we'll make it right.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: sticky order bar */}
      <style>{`
        @media (max-width: 768px) {
          .svc-detail-grid { grid-template-columns: 1fr !important; }
          .svc-detail-right { position: static !important; }
        }
      `}</style>
    </div>
  )
}
