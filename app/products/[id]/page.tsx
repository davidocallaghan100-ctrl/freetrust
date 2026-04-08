'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const MOCK_PRODUCTS: Record<string, {
  id: string; title: string; category: string; price: number; currency: string;
  seller: string; avatar: string; rating: number; reviews: number; sales: number;
  desc: string; tags: string[]; badge: string | null; whatYouGet: string[];
}> = {
  '1': {
    id: '1', title: 'Figma Component Library Pro', category: 'Digital Downloads', price: 49, currency: '£',
    seller: 'Sarah Chen', avatar: 'SC', rating: 4.9, reviews: 312, sales: 1840,
    desc: '850+ production-ready Figma components with auto-layout, variants, and dark mode. Used by over 1,800 designers worldwide.',
    tags: ['Figma', 'UI Kit', 'Design System'], badge: 'Bestseller',
    whatYouGet: ['850+ Figma components', 'Auto-layout support', 'Dark & light mode variants', 'Free updates for life', 'Documentation included', 'Instant download'],
  },
  '2': {
    id: '2', title: 'Next.js SaaS Boilerplate', category: 'Templates', price: 129, currency: '£',
    seller: 'Priya Nair', avatar: 'PN', rating: 5.0, reviews: 89, sales: 420,
    desc: 'Production-ready Next.js 14 starter with auth, billing, dashboard and Supabase integration. Skip weeks of boilerplate.',
    tags: ['Next.js', 'TypeScript', 'Supabase'], badge: 'Top Rated',
    whatYouGet: ['Full Next.js 14 codebase', 'Supabase auth + DB', 'Stripe billing', 'Dashboard template', 'Deployment guide', 'MIT license'],
  },
}

const avatarGrad: Record<string, string> = {
  SC: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  MO: 'linear-gradient(135deg,#34d399,#059669)',
  TW: 'linear-gradient(135deg,#fb923c,#ea580c)',
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
  JO: 'linear-gradient(135deg,#38bdf8,#7c3aed)',
  YT: 'linear-gradient(135deg,#34d399,#38bdf8)',
}

function getGrad(str: string): string {
  const grads = ['linear-gradient(135deg,#38bdf8,#0284c7)', 'linear-gradient(135deg,#a78bfa,#7c3aed)', 'linear-gradient(135deg,#34d399,#059669)', 'linear-gradient(135deg,#fb923c,#ea580c)']
  return grads[str.charCodeAt(0) % grads.length]
}

const categoryIcons: Record<string, string> = {
  'Digital Downloads': '💾', 'Physical Goods': '📦', Templates: '📋',
  Courses: '🎓', Software: '⚙️', Books: '📚',
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const productId = params.id as string

  const [product, setProduct] = useState<typeof MOCK_PRODUCTS['1'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [buying, setBuying] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        setAuthed(!!user)

        const { data } = await supabase
          .from('listings')
          .select('*, seller:profiles(full_name)')
          .eq('id', productId)
          .single()
        if (data) {
          const name = (data.seller as { full_name?: string } | null)?.full_name || 'Unknown'
          const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
          setProduct({
            id: data.id, title: data.title, category: data.category || 'Digital Downloads',
            price: Number(data.price), currency: '£', seller: name, avatar: initials,
            rating: 4.8, reviews: 0, sales: 0,
            desc: data.description || '', tags: data.tags || [], badge: null,
            whatYouGet: ['Instant digital delivery', 'Full licence', 'Free updates'],
          })
        } else {
          setProduct(MOCK_PRODUCTS[productId] || null)
        }
      } catch {
        setProduct(MOCK_PRODUCTS[productId] || null)
      } finally {
        setLoading(false)
      }
    })()
  }, [productId])

  async function handleBuyNow() {
    if (!authed) {
      router.push('/login?redirect=/products/' + productId)
      return
    }
    setBuying(true)
    try {
      const res = await fetch('/api/checkout/product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      })
      const data = await res.json()

      if (res.status === 503) {
        showToast('Payments not yet configured (Stripe key not set).', 'error')
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
          Loading product...
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1f5f9' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
          <h2>Product not found</h2>
          <Link href="/products" style={{ color: '#38bdf8', textDecoration: 'none' }}>← Back to Products</Link>
        </div>
      </div>
    )
  }

  const fee = Math.round(product.price * 0.05 * 100) / 100

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', paddingTop: '4rem' }}>
      <style>{`
        .prod-detail-grid { display: grid; grid-template-columns: 1fr 340px; gap: 2rem; max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
        @media (max-width: 768px) { .prod-detail-grid { grid-template-columns: 1fr !important; padding: 1rem !important; } }
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
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <Link href="/products" style={{ color: '#64748b', textDecoration: 'none', fontSize: '0.875rem' }}>← Products</Link>
        </div>
      </div>

      <div className="prod-detail-grid">
        {/* Left: product info */}
        <div>
          {/* Product thumbnail */}
          <div style={{
            height: 240, borderRadius: 16, marginBottom: '1.5rem',
            background: 'linear-gradient(135deg, rgba(56,189,248,0.1), rgba(148,163,184,0.05))',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            border: '1px solid rgba(148,163,184,0.1)', gap: '0.5rem',
          }}>
            <span style={{ fontSize: '4rem' }}>{categoryIcons[product.category] || '📦'}</span>
            {product.badge && (
              <span style={{
                background: product.badge === 'Bestseller' ? '#fbbf24' : product.badge === 'Top Rated' ? '#38bdf8' : '#34d399',
                color: '#0f172a', borderRadius: 20, padding: '0.3rem 0.8rem', fontSize: '0.8rem', fontWeight: 700,
              }}>
                {product.badge}
              </span>
            )}
          </div>

          {/* Seller row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: avatarGrad[product.avatar] || getGrad(product.avatar), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#0f172a' }}>
              {product.avatar}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: '0.9rem' }}>{product.seller}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{product.category}</div>
            </div>
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 900, margin: '0 0 0.75rem' }}>{product.title}</h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: '#fbbf24', fontWeight: 700 }}>★ {product.rating}</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>({product.reviews} reviews)</span>
            <span style={{ color: '#64748b', fontSize: '0.875rem' }}>{product.sales.toLocaleString()} sales</span>
          </div>

          <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid rgba(148,163,184,0.1)' }}>
            <p style={{ color: '#94a3b8', lineHeight: 1.7, margin: 0 }}>{product.desc}</p>
          </div>

          {/* Tags */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {product.tags.map(tag => (
              <span key={tag} style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 20, padding: '0.3rem 0.8rem', fontSize: '0.8rem', color: '#94a3b8' }}>
                {tag}
              </span>
            ))}
          </div>

          {/* What you get */}
          <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', border: '1px solid rgba(52,211,153,0.15)' }}>
            <h3 style={{ margin: '0 0 0.875rem', fontSize: '0.95rem', fontWeight: 700 }}>What you get</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {product.whatYouGet.map(item => (
                <li key={item} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.875rem', color: '#94a3b8' }}>
                  <span style={{ color: '#34d399', fontWeight: 700 }}>✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right: buy box */}
        <div style={{ position: 'sticky', top: '5rem', height: 'fit-content' }}>
          <div style={{ background: '#1e293b', borderRadius: 16, padding: '1.5rem', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#38bdf8', marginBottom: '0.5rem' }}>
              {product.currency}{product.price}
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1.25rem' }}>
              One-time purchase · Instant delivery
            </div>

            {/* Fee breakdown */}
            <div style={{ background: 'rgba(56,189,248,0.05)', borderRadius: 8, padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Product price</span><span style={{ color: '#f1f5f9' }}>{product.currency}{product.price}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span>Platform fee (5%)</span><span style={{ color: '#f87171' }}>−{product.currency}{fee.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: '#34d399', borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                <span>Seller receives</span><span>{product.currency}{(product.price - fee).toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', fontSize: '0.8rem', color: '#38bdf8' }}>
              <span>₮</span> +₮5 trust earned on purchase
            </div>

            <button
              onClick={handleBuyNow}
              disabled={buying}
              style={{
                width: '100%', padding: '0.875rem', background: buying ? '#0284c7' : '#38bdf8',
                color: '#0f172a', border: 'none', borderRadius: 10, fontWeight: 800,
                fontSize: '1rem', cursor: buying ? 'wait' : 'pointer', transition: 'background 0.2s',
              }}
            >
              {buying ? 'Redirecting...' : authed ? `Buy Now · ${product.currency}${product.price}` : 'Sign in to Purchase'}
            </button>

            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '0.75rem' }}>
              🔒 Secure checkout powered by Stripe
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
              Satisfaction guaranteed or dispute within 14 days
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
