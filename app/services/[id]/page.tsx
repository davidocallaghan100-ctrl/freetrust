'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ALL_CATEGORIES, DELIVERY_OPTIONS } from '@/lib/service-categories'
import { useCurrency } from '@/context/CurrencyContext'

// ─── Types ────────────────────────────────────────────────────────────────────

type PkgId = 'basic' | 'standard' | 'premium'

type Package = {
  id: PkgId
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
    trust: number
  }
  packages: Package[]
  description: string
  faq: { q: string; a: string }[]
  tags: string[]
  reviews: Review[]
}

// ─── Mock data ────────────────────────────────────────────────────────────────

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
      trust: 4200,
    },
    packages: [
      { id: 'basic',    label: 'Basic',    price: 49,  delivery: '3 days', revisions: 2,  description: 'Clean, simple logo for early-stage brands.', features: ['1 concept', 'PNG & SVG files', '2 revisions', 'Commercial use'] },
      { id: 'standard', label: 'Standard', price: 99,  delivery: '5 days', revisions: 5,  description: 'Full brand kit — most popular choice.', features: ['3 concepts', 'All file formats', '5 revisions', 'Brand style guide', 'Social media kit'] },
      { id: 'premium',  label: 'Premium',  price: 199, delivery: '7 days', revisions: -1, description: 'Complete brand identity with everything included.', features: ['5 concepts', 'All file formats', 'Unlimited revisions', 'Full brand guide', 'Source files (AI/EPS)', 'Priority support'] },
    ],
    description: 'A professional, memorable logo crafted from scratch — no templates. Includes full commercial rights and all file formats.\n\nI work closely with each client to understand their vision, target audience, and brand values before designing. Every concept is original and tailored specifically to your business.\n\nYou\'ll receive all source files plus guidelines on usage, typography, and colour palette.',
    faq: [
      { q: 'What do you need to get started?', a: 'Business name, industry, target audience, and any colour/style preferences. A brief questionnaire is sent after purchase.' },
      { q: 'Can I request changes after delivery?', a: 'Yes — revisions are included in every package. Unlimited on the Premium package.' },
      { q: 'Do I own the copyright?', a: 'Yes. Full commercial rights transfer to you upon delivery and payment.' },
    ],
    tags: ['logo design', 'brand identity', 'startup branding'],
    reviews: [
      { id: 'r1', author: 'Sarah K.', avatar: 'https://i.pravatar.cc/150?img=5', country: 'United States', rating: 5, date: '2024-05-12', body: 'Alex delivered exactly what I envisioned — and then some. The brand guide is incredibly detailed. Highly recommend!', helpful: 24 },
      { id: 'r2', author: 'James T.', avatar: 'https://i.pravatar.cc/150?img=8', country: 'Australia', rating: 5, date: '2024-04-28', body: 'Third time working with Alex and still blown away every time. Fastest turnaround I\'ve seen.', helpful: 17 },
    ],
  },
}

function getMock(id: string): ServiceDetail {
  return MOCK[id] ?? { ...MOCK['svc-001'], id }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: '1px' }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} style={{ color: n <= Math.round(rating) ? '#fbbf24' : '#334155', fontSize: size + 'px' }}>★</span>
      ))}
    </span>
  )
}

function Avatar({ url, name, size = 48 }: { url: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, display: 'block' }} />
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: Math.round(size * 0.33) + 'px', color: '#0f172a', flexShrink: 0 }}>{initials}</div>
}

const PKG_COLORS: Record<PkgId, string> = { basic: '#60a5fa', standard: '#a78bfa', premium: '#fbbf24' }
const PKG_BG: Record<PkgId, string> = { basic: 'rgba(96,165,250,0.08)', standard: 'rgba(167,139,250,0.08)', premium: 'rgba(251,191,36,0.08)' }

// ─── Collapsible FAQ item ─────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid #1e293b' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', fontFamily: 'inherit', textAlign: 'left' }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.4 }}>{q}</span>
        <span style={{ fontSize: '16px', color: '#475569', flexShrink: 0, transition: 'transform 0.2s', display: 'inline-block', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </button>
      {open && <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.65, margin: '0 0 14px', paddingRight: '24px' }}>{a}</p>}
    </div>
  )
}

// ─── Package selector (interactive) ──────────────────────────────────────────

function PackageSelector({ packages, serviceId }: { packages: Package[]; serviceId: string }) {
  const { format } = useCurrency()
  const [activePkg, setActivePkg] = useState<PkgId>('standard')
  const pkg = packages.find(p => p.id === activePkg) ?? packages[1] ?? packages[0]

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '16px', overflow: 'hidden' }}>
      {/* Tab row */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${packages.length}, 1fr)`, borderBottom: '1px solid #334155' }}>
        {packages.map(p => (
          <button
            key={p.id}
            onClick={() => setActivePkg(p.id)}
            style={{
              padding: '12px 6px',
              border: 'none',
              borderBottom: activePkg === p.id ? `2px solid ${PKG_COLORS[p.id]}` : '2px solid transparent',
              background: activePkg === p.id ? PKG_BG[p.id] : 'transparent',
              color: activePkg === p.id ? PKG_COLORS[p.id] : '#64748b',
              fontSize: '13px',
              fontWeight: activePkg === p.id ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Active package body */}
      <div style={{ padding: '18px' }}>
        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '6px' }}>
          <span style={{ fontSize: '32px', fontWeight: 900, color: '#f1f5f9', letterSpacing: '-1px' }}>{format(pkg.price, 'GBP')}</span>
          <span style={{ fontSize: '13px', color: '#64748b' }}>/ project</span>
        </div>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 14px', lineHeight: 1.5 }}>{pkg.description}</p>

        {/* Meta */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', marginBottom: '14px', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>⏱</span> {pkg.delivery}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span>🔄</span> {pkg.revisions < 0 ? 'Unlimited' : pkg.revisions} revision{pkg.revisions !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Features */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {pkg.features.map((f, i) => (
            <li key={i} style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{ color: '#34d399', flexShrink: 0, marginTop: '1px' }}>✓</span> {f}
            </li>
          ))}
        </ul>

        {/* CTA */}
        <Link
          href={`/checkout?service=${serviceId}&pkg=${pkg.id}`}
          style={{ display: 'block', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '12px', padding: '14px', textAlign: 'center', fontWeight: 800, fontSize: '15px', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.25)' }}
        >
          Continue — {format(pkg.price, 'GBP')}
        </Link>

        {/* Compare row */}
        <div style={{ marginTop: '14px', display: 'grid', gridTemplateColumns: `repeat(${packages.length}, 1fr)`, borderTop: '1px solid #334155', paddingTop: '12px', gap: '4px' }}>
          {packages.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePkg(p.id)}
              style={{ textAlign: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '8px', transition: 'background 0.15s', fontFamily: 'inherit' }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: PKG_COLORS[p.id], textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.label}</div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: activePkg === p.id ? '#f1f5f9' : '#64748b' }}>{format(p.price, 'GBP')}</div>
              <div style={{ fontSize: '10px', color: '#475569' }}>{p.delivery}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Mobile sticky book bar ───────────────────────────────────────────────────

function MobileStickyBar({ packages, serviceId }: { packages: Package[]; serviceId: string }) {
  const { format } = useCurrency()
  const [activePkg, setActivePkg] = useState<PkgId>('standard')
  const [showPicker, setShowPicker] = useState(false)
  const pkg = packages.find(p => p.id === activePkg) ?? packages[1] ?? packages[0]

  return (
    <>
      {/* Backdrop */}
      {showPicker && (
        <div
          onClick={() => setShowPicker(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 49, backdropFilter: 'blur(2px)' }}
        />
      )}

      {/* Bottom sheet package picker */}
      {showPicker && (
        <div style={{ position: 'fixed', bottom: 72, left: 0, right: 0, zIndex: 50, background: '#1e293b', borderTop: '1px solid #334155', borderRadius: '20px 20px 0 0', padding: '8px 16px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Handle */}
          <div style={{ width: 40, height: 4, background: '#334155', borderRadius: 99, margin: '8px auto 16px' }} />
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>Choose a package</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {packages.map(p => (
              <button
                key={p.id}
                onClick={() => { setActivePkg(p.id); setShowPicker(false) }}
                style={{ background: activePkg === p.id ? PKG_BG[p.id] : 'rgba(255,255,255,0.03)', border: `1.5px solid ${activePkg === p.id ? PKG_COLORS[p.id] : '#334155'}`, borderRadius: '12px', padding: '14px', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: PKG_COLORS[p.id] }}>{p.label}</span>
                    {activePkg === p.id && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#34d399', fontWeight: 600 }}>✓ Selected</span>}
                  </div>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#f1f5f9' }}>{format(p.price, 'GBP')}</span>
                </div>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px', lineHeight: 1.4 }}>{p.description}</p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#475569' }}>
                  <span>⏱ {p.delivery}</span>
                  <span>🔄 {p.revisions < 0 ? 'Unlimited' : p.revisions} revisions</span>
                </div>
                <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {p.features.map((f, i) => (
                    <span key={i} style={{ fontSize: '10px', color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: 999 }}>✓ {f}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sticky bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 48, background: '#0f172a', borderTop: '1px solid #1e293b', padding: '10px 16px 20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        {/* Package selector pill */}
        <button
          onClick={() => setShowPicker(v => !v)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', background: '#1e293b', border: `1px solid ${PKG_COLORS[activePkg]}`, borderRadius: '12px', padding: '8px 12px', cursor: 'pointer', minWidth: 90, fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: '10px', color: PKG_COLORS[activePkg], fontWeight: 700, textTransform: 'uppercase' }}>{pkg.label} ▾</span>
          <span style={{ fontSize: '16px', fontWeight: 900, color: '#f1f5f9' }}>{format(pkg.price, 'GBP')}</span>
        </button>

        {/* CTA */}
        <Link
          href={`/checkout?service=${serviceId}&pkg=${pkg.id}`}
          style={{ flex: 1, display: 'block', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', borderRadius: '12px', padding: '14px', textAlign: 'center', fontWeight: 800, fontSize: '15px', color: '#fff', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.25)' }}
        >
          Book Now — {format(pkg.price, 'GBP')}
        </Link>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = typeof params.id === 'string' ? params.id : ''

  const svc = getMock(id)
  const catInfo = ALL_CATEGORIES.find(c => c.id === svc.categoryId)
  const deliveryLabels = svc.deliveryTypes
    ? svc.deliveryTypes.map(d => DELIVERY_OPTIONS.find(o => o.id === d)).filter(Boolean)
    : []

  const card: React.CSSProperties = { background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 104 }}>
      <style>{`
        .sd-grid { display: grid; grid-template-columns: 1fr 340px; gap: 24px; align-items: start; }
        .sd-right { position: sticky; top: 112px; }
        /* On mobile: single column, right col goes above content, sticky bar replaces desktop CTA */
        @media (max-width: 768px) {
          .sd-grid { grid-template-columns: 1fr; }
          .sd-right { position: static; display: none; }
          .sd-mobile-pkg { display: block !important; }
          .sd-mobile-bar { display: flex !important; }
          .sd-main { padding-bottom: 100px !important; }
        }
        @media (min-width: 769px) {
          .sd-mobile-pkg { display: none !important; }
          .sd-mobile-bar { display: none !important; }
        }
      `}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px 16px 80px' }} className="sd-main">

        {/* Breadcrumb */}
        <nav style={{ fontSize: '12px', color: '#475569', marginBottom: '16px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0, fontSize: '12px', fontFamily: 'inherit' }}>← Back</button>
          <span>·</span>
          <Link href="/services" style={{ color: '#64748b', textDecoration: 'none' }}>Services</Link>
          {catInfo && <><span>›</span><span style={{ color: '#94a3b8' }}>{catInfo.icon} {catInfo.label}</span></>}
        </nav>

        {/* Mobile: package selector sits at the top */}
        <div className="sd-mobile-pkg" style={{ marginBottom: '20px' }}>
          <PackageSelector packages={svc.packages} serviceId={svc.id} />
        </div>

        <div className="sd-grid">

          {/* ── Left / main column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Title + rating */}
            <div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', padding: '3px 10px', borderRadius: '20px' }}>
                  {catInfo?.icon} {catInfo?.label ?? svc.category}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, background: svc.mode === 'online' ? 'rgba(56,189,248,0.08)' : 'rgba(52,211,153,0.08)', color: svc.mode === 'online' ? '#38bdf8' : '#34d399', padding: '3px 10px', borderRadius: '20px' }}>
                  {svc.mode === 'online' ? '💻 Online' : '📍 Local'}
                </span>
                {svc.location && (
                  <span style={{ fontSize: '11px', color: '#64748b', padding: '3px 10px', borderRadius: '20px', background: '#1e293b' }}>
                    📍 {svc.location}{svc.distance ? ` · ${svc.distance}km` : ''}
                  </span>
                )}
              </div>
              <h1 style={{ fontSize: 'clamp(17px,4vw,22px)', fontWeight: 800, lineHeight: 1.3, margin: '0 0 10px' }}>{svc.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '13px', color: '#94a3b8' }}>
                <Stars rating={svc.rating} />
                <strong style={{ color: '#fbbf24' }}>{svc.rating.toFixed(1)}</strong>
                <span>({svc.reviewCount} reviews)</span>
                <span style={{ color: '#334155' }}>·</span>
                <span>{svc.seller.totalOrders.toLocaleString()} orders</span>
              </div>
            </div>

            {/* Seller mini row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px' }}>
              <Avatar url={svc.seller.avatar} name={svc.seller.name} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <Link href={`/profile/${svc.seller.username}`} style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' }}>{svc.seller.name}</Link>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.1)', padding: '2px 7px', borderRadius: 999 }}>{svc.seller.level}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  ⚡ Responds in {svc.seller.responseTime} · ₮{svc.seller.trust.toLocaleString()} trust
                </div>
              </div>
              <Link href={`/messages`} style={{ fontSize: '12px', fontWeight: 700, color: '#38bdf8', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', padding: '7px 12px', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                💬 Message
              </Link>
            </div>

            {/* Cover image */}
            {svc.images[0] && (
              <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #334155', background: '#1e293b' }}>
                <img src={svc.images[0]} alt={svc.title} style={{ width: '100%', maxHeight: '340px', objectFit: 'cover', display: 'block' }} />
              </div>
            )}

            {/* Delivery types */}
            {deliveryLabels.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {deliveryLabels.map(d => d && (
                  <span key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px', fontSize: '12px', color: '#94a3b8' }}>
                    {d.icon} {d.label}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '10px' }}>About This Service</div>
              <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.75, whiteSpace: 'pre-wrap', margin: 0 }}>{svc.description}</p>
            </div>

            {/* Tags */}
            {svc.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {svc.tags.map(t => (
                  <Link key={t} href={`/search?q=${encodeURIComponent(t)}`} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid #334155', borderRadius: '20px', padding: '4px 12px', fontSize: '12px', color: '#64748b', textDecoration: 'none' }}>
                    #{t}
                  </Link>
                ))}
              </div>
            )}

            {/* FAQ — collapsible */}
            {svc.faq.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>FAQs</div>
                {svc.faq.map((f, i) => <FaqItem key={i} q={f.q} a={f.a} />)}
              </div>
            )}

            {/* Reviews */}
            {svc.reviews.length > 0 && (
              <div style={card}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '16px' }}>
                  Reviews <span style={{ color: '#475569', fontWeight: 400 }}>({svc.reviewCount})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  {svc.reviews.map(r => (
                    <div key={r.id} style={{ borderBottom: '1px solid #334155', paddingBottom: '18px' }}>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', alignItems: 'flex-start' }}>
                        <Avatar url={r.avatar} name={r.author} size={36} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{r.author}</span>
                            <Stars rating={r.rating} />
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {r.country} · {new Date(r.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.65, margin: 0 }}>{r.body}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seller full card — mobile only shows below content */}
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', marginBottom: '14px' }}>About the Seller</div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                <Avatar url={svc.seller.avatar} name={svc.seller.name} size={52} />
                <div>
                  <Link href={`/profile/${svc.seller.username}`} style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none', display: 'block' }}>{svc.seller.name}</Link>
                  <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>{svc.seller.level}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {svc.seller.location} · since {svc.seller.memberSince}</div>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.65, margin: '0 0 14px' }}>{svc.seller.bio}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', marginBottom: '14px' }}>
                {[
                  ['📦 Orders', svc.seller.totalOrders.toLocaleString()],
                  ['✅ Completion', `${svc.seller.completionRate}%`],
                  ['⚡ Response', svc.seller.responseTime],
                  ['🌐 Languages', svc.seller.languages.join(', ')],
                ].map(([label, val]) => (
                  <div key={label} style={{ background: 'rgba(56,189,248,0.05)', borderRadius: '8px', padding: '8px 10px' }}>
                    <div style={{ color: '#475569', marginBottom: '2px', fontSize: '11px' }}>{label}</div>
                    <div style={{ color: '#f1f5f9', fontWeight: 700 }}>{val}</div>
                  </div>
                ))}
              </div>
              {svc.seller.skills.length > 0 && (
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {svc.seller.skills.map(s => (
                    <span key={s} style={{ fontSize: '10px', padding: '3px 8px', background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '20px', color: '#38bdf8' }}>{s}</span>
                  ))}
                </div>
              )}
              <Link href={`/profile/${svc.seller.username}`} style={{ display: 'block', padding: '9px', textAlign: 'center', border: '1px solid #334155', borderRadius: '10px', fontSize: '12px', fontWeight: 600, color: '#94a3b8', textDecoration: 'none' }}>
                View Full Profile
              </Link>
            </div>

            {/* Trust guarantee */}
            <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '20px', flexShrink: 0 }}>🛡️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '3px', fontSize: '13px' }}>FreeTrust Guarantee</div>
                Your payment is held securely in escrow and only released when you confirm delivery. If something goes wrong, we step in and make it right.
              </div>
            </div>

          </div>

          {/* ── Right column (desktop only) ── */}
          <div className="sd-right" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <PackageSelector packages={svc.packages} serviceId={svc.id} />

            {/* Trust badge desktop */}
            <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#64748b', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '18px', flexShrink: 0 }}>🛡️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#38bdf8', marginBottom: '2px' }}>FreeTrust Guarantee</div>
                Payment held securely. Released only on confirmed delivery.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky bottom bar */}
      <div className="sd-mobile-bar" style={{ display: 'none' }}>
        <MobileStickyBar packages={svc.packages} serviceId={svc.id} />
      </div>
    </div>
  )
}
