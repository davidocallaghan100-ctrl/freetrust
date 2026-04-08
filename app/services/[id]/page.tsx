'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MOCK_SERVICES: Record<string, {
  id: string; title: string; provider: string; avatar: string; rating: number; reviews: number;
  price: number; currency: string; delivery: string; tags: string[]; category: string;
  desc: string; trust: number; badge: string | null;
  packages: { name: string; price: number; delivery: string; desc: string; features: string[] }[]
}> = {
  '1': {
    id: '1', title: 'Brand Identity Design', provider: 'Sarah Chen', avatar: 'SC',
    rating: 4.9, reviews: 127, price: 450, currency: '£', delivery: '5 days',
    tags: ['Logo', 'Brand', 'Figma'], category: 'Design & Creative',
    desc: 'Complete brand identity including logo, colour palette, typography and brand guidelines. I bring years of experience creating identities for startups and SMEs across Europe.',
    trust: 98, badge: 'Top Rated',
    packages: [
      { name: 'Basic', price: 150, delivery: '3 days', desc: 'Logo only', features: ['1 logo concept', '3 revisions', 'PNG & SVG files', 'Source files'] },
      { name: 'Standard', price: 450, delivery: '5 days', desc: 'Full brand identity', features: ['3 logo concepts', 'Unlimited revisions', 'Colour palette', 'Typography guide', 'Brand guidelines PDF'] },
      { name: 'Premium', price: 950, delivery: '10 days', desc: 'Complete brand system', features: ['Everything in Standard', 'Business cards', 'Social media kit', 'Brand strategy session', '1 year support'] },
    ],
  },
  '2': {
    id: '2', title: 'Full-Stack Web App Development', provider: 'Priya Nair', avatar: 'PN',
    rating: 5.0, reviews: 89, price: 2800, currency: '£', delivery: '21 days',
    tags: ['Next.js', 'Supabase', 'TypeScript'], category: 'Development',
    desc: 'End-to-end web application development using modern tech stack. From MVP to production. Specialising in Next.js, Supabase, and TypeScript.',
    trust: 100, badge: 'Verified',
    packages: [
      { name: 'Basic', price: 800, delivery: '7 days', desc: 'Landing page', features: ['Responsive design', 'Up to 5 pages', 'Contact form', 'SEO basics'] },
      { name: 'Standard', price: 2800, delivery: '21 days', desc: 'Full web app MVP', features: ['Auth system', 'Database design', 'API routes', 'Dashboard', 'Deployment'] },
      { name: 'Premium', price: 6500, delivery: '45 days', desc: 'Production SaaS', features: ['Everything in Standard', 'Payments integration', 'Admin panel', 'Analytics', '3 months support'] },
    ],
  },
}

const avatarGrad: Record<string, string> = {
  SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  MO: 'linear-gradient(135deg,#34d399,#059669)',
  TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
}

function getGrad(str: string): string {
  const grads = ['linear-gradient(135deg,#38bdf8,#0284c7)', 'linear-gradient(135deg,#a78bfa,#7c3aed)', 'linear-gradient(135deg,#34d399,#059669)', 'linear-gradient(135deg,#fb923c,#ea580c)']
  return grads[str.charCodeAt(0) % grads.length]
}

export default function ServiceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const serviceId = params.id as string

  type ServiceType = typeof MOCK_SERVICES['1']
  const [service, setService] = useState<ServiceType | null>(null)
  const [selectedPackage, setSelectedPackage] = useState(1) // 0=Basic, 1=Standard, 2=Premium
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setAuthed(!!user)

        // Try Supabase first
        const { data } = await supabase
          .from('listings')
          .select('*, seller:profiles(full_name)')
          .eq('id', serviceId)
          .single()
        if (data) {
          const name = (data.seller as { full_name?: string } | null)?.full_name || 'Unknown'
          const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          setService({
            id: data.id, title: data.title, provider: name, avatar: initials,
            rating: 4.8, reviews: 0, price: Number(data.price), currency: '£', delivery: '7 days',
            tags: data.tags || [], category: 'Service', desc: data.description || '',
            trust: 90, badge: null,
            packages: [
              { name: 'Basic', price: Math.round(Number(data.price) * 0.5), delivery: '5 days', desc: 'Essential package', features: ['Core deliverables', '2 revisions', 'Source files'] },
              { name: 'Standard', price: Number(data.price), delivery: '7 days', desc: 'Standard package', features: ['Everything in Basic', '5 revisions', 'Priority support'] },
              { name: 'Premium', price: Math.round(Number(data.price) * 2), delivery: '14 days', desc: 'Premium package', features: ['Everything in Standard', 'Unlimited revisions', '1 month support', 'Rush delivery available'] },
            ],
          })
        } else {
          setService(MOCK_SERVICES[serviceId] || null)
        }
      } catch {
        setService(MOCK_SERVICES[serviceId] || null)
      } finally {
        setLoading(false)
      }
    })()
  }, [serviceId])

  async function handleBuyNow() {
    if (!authed) {
      router.push('/login?redirect=/services/' + serviceId)
      return
    }
    setBuying(true)
    try {
      const pkg = service!.packages[selectedPackage]
      const res = await fetch('/api/checkout/service', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_id: serviceId, package_tier: pkg.name }),
      })
      const data = await res.json()

      if (res.status === 503) {
        // Stripe not configured — show demo message
        showToast('Payments not yet configured (Stripe key not set). Order will be created in demo mode.', 'error')
        setBuying(false)
        return
      }

      if (!res.ok) {
        showToast(data.error || 'Checkout failed', 'error')
        setBuying(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
      } else if (data.order_id) {
        router.push(`/orders/${data.order_id}/success`)
      }
    } catch (e) {
      showToast('Something went wrong', 'error')
      setBuying(false)
    }
  }

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          Loading service...
        </div>
      </div>
    )
  }

  if (!service) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h2>Service not found</h2>
          <Link href="/services" style={{ color: '#38bdf8', textDecoration: 'none' }}>← Back to Services</Link>
        </div>
      </div>
    )
  }

  const pkg = service.packages[selectedPackage]
  const fee = Math.round(pkg.price * 0.08 * 100) / 100

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingTop: '4rem' }}>
      <style>{`
        .svc-detail-grid { display: grid; grid-template-columns: 1fr 360px; gap: 2rem; max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem; }
        .pkg-card { background: #1e293b; border: 2px solid transparent; border-radius: 12px; padding: 1.25rem; cursor: pointer; transition: border-color 0.2s; }
        .pkg-card.active { border-color: #38bdf8; }
        @media (max-width: 768px) {
          .svc-detail-grid { grid-template-columns: 1fr !important; padding: 1rem !important; }
          .buy-sidebar { position: static !important; }
        }
      `}</style>

      {toast && (
        <div style={{
          position: 'fixed', top: '5rem', right: '1rem', zIndex: 9999,
          background: toast.type === 'success' ? '#0f2d1a' : '#2d0f0f',
          border: `1px solid ${toast.type === 'success' ? '#34d399' : '#f87171'}`,
          color: toast.type === 'success' ? '#34d399' : '#f87171',
          padding: '0.875rem 1.25rem', borderRadius: 10, fontWeight: 600, fontSize: '0.9rem',
          maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {toast.msg}
        </div>
      )}

      <div style={{ background: 'linear-gradient(180deg, rgba(56,189,248,0.05) 0%, transparent 100%)', padding: '1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Link href="/services" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem' }}>← Services</Link>
        </div>
      </div>

      <div className="svc-detail-grid">
        {/* Left: service details */}
        <div>
          {/* Provider row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: avatarGrad[service.avatar] || getGrad(service.avatar), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>
              {service.avatar}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9' }}>{service.provider}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{service.category}</div>
            </div>
            {service.badge && (
              <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 20, padding: '0.25rem 0.7rem', fontSize: '0.75rem', color: '#38bdf8' }}>
                {service.badge}
              </span>
            )}
          </div>

          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: '0 0 1rem', lineHeight: 1.2 }}>{service.title}</h1>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>★ {service.rating}</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>({service.reviews} reviews)</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>⏱ {service.delivery}</span>
            <span style={{ color: '#38bdf8', fontSize: '0.875rem' }}>Trust: {service.trust}%</span>
          </div>

          {/* Description */}
          <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid rgba(148,163,184,0.1)' }}>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{service.desc}</p>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
            {service.tags.map(tag => (
              <span key={tag} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 20, padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Packages */}
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>Choose a Package</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {service.packages.map((p, i) => (
              <div key={p.name} className={`pkg-card${selectedPackage === i ? ' active' : ''}`} onClick={() => setSelectedPackage(i)}>
                <div style={{ fontWeight: 700, color: selectedPackage === i ? '#38bdf8' : '#f1f5f9', marginBottom: '0.25rem' }}>{p.name}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.25rem' }}>£{p.price}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>⏱ {p.delivery}</div>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.75rem' }}>{p.desc}</div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {p.features.map(f => (
                    <li key={f} style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                      <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span> {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Right: sticky buy box */}
        <div className="buy-sidebar" style={{ position: 'sticky', top: '5rem', height: 'fit-content' }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.5rem', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '0.25rem' }}>{pkg.name} Package</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.25rem' }}>£{pkg.price}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>⏱ Delivery: {pkg.delivery}</div>

            {/* Features list */}
            <ul style={{ margin: '0 0 1.25rem', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {pkg.features.map(f => (
                <li key={f} style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span> {f}
                </li>
              ))}
            </ul>

            {/* Fee info */}
            <div style={{ background: 'rgba(56,189,248,0.05)', borderRadius: 8, padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Service price</span><span style={{ color: '#f1f5f9' }}>£{pkg.price}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Platform fee (8%)</span><span style={{ color: '#f87171' }}>−£{fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#34d399', borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                <span>Seller receives</span><span>£{(pkg.price - fee).toFixed(2)}</span>
              </div>
            </div>

            {/* Trust reward */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#38bdf8' }}>
              <span>₮</span> +₮5 trust earned on purchase
            </div>

            {/* Buy button */}
            <button
              onClick={handleBuyNow}
              disabled={buying}
              style={{
                width: '100%', padding: '0.875rem', background: buying ? '#0284c7' : '#38bdf8',
                color: '#0f172a', border: 'none', borderRadius: 10, fontWeight: 800,
                fontSize: '1rem', cursor: buying ? 'wait' : 'pointer', transition: 'background 0.2s',
              }}
            >
              {buying ? 'Redirecting to checkout...' : authed ? `Buy Now · £${pkg.price}` : 'Sign in to Purchase'}
            </button>

            {/* Escrow message */}
            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>
              🔒 Payment held securely in escrow until delivery
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
