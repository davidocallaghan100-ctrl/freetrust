'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CartItem = { id: string; title: string; price: number; currency: string; qty: number; image: string }

function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('ft_cart') || '[]') } catch { return [] }
}
function saveCart(c: CartItem[]) {
  localStorage.setItem('ft_cart', JSON.stringify(c))
  window.dispatchEvent(new Event('ft-cart-updated'))
}

function fmt(p: number, cur: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(p / 100)
}

const TRUST_FEE_PCT = 5
const FREE_SHIPPING_THRESHOLD = 5000 // €50

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
    setCart(getCart())
    const onUpdate = () => setCart(getCart())
    window.addEventListener('ft-cart-updated', onUpdate)
    return () => window.removeEventListener('ft-cart-updated', onUpdate)
  }, [])

  function updateQty(id: string, delta: number) {
    const c = getCart().map(item => item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item)
    saveCart(c)
  }

  function removeItem(id: string) {
    saveCart(getCart().filter(item => item.id !== id))
  }

  function applyPromo() {
    setPromoError('')
    if (promoCode.trim().toUpperCase() === 'FOUNDING25') {
      setPromoApplied(true)
    } else {
      setPromoError('Invalid promo code')
    }
  }

  async function handleCheckout() {
    setCheckoutLoading(true)
    // Stub — will wire to Stripe when key is added
    await new Promise(r => setTimeout(r, 800))
    router.push('/checkout/success')
  }

  // Calculations
  const currency = cart[0]?.currency ?? 'GBP'
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = promoApplied ? Math.round(subtotal * 0.25) : 0
  const afterDiscount = subtotal - discount
  const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : 499
  const fee = Math.round(afterDiscount * (TRUST_FEE_PCT / 100))
  const total = afterDiscount + shipping + fee

  // theme
  const bg = '#0f172a'
  const card = '#1e293b'
  const border = 'rgba(56,189,248,0.1)'
  const accent = '#38bdf8'
  const text = '#f1f5f9'
  const muted = '#64748b'

  if (!mounted) return (
    <main style={{ minHeight: '100vh', background: bg, paddingTop: 104, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: muted, fontSize: '0.9rem' }}>Loading cart…</div>
    </main>
  )

  if (cart.length === 0) return (
    <main style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingTop: 104, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
      <div style={{ fontSize: '4rem' }}>🛒</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Your cart is empty</h1>
      <p style={{ color: muted, margin: 0 }}>Add some products to get started.</p>
      <Link href="/products" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.85rem 2rem', borderRadius: 12, fontWeight: 800, textDecoration: 'none', fontSize: '0.95rem' }}>
        Browse Products →
      </Link>
    </main>
  )

  return (
    <main style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingTop: 104, paddingBottom: 80 }}>
      <style>{`
        @media (max-width: 900px) { .cart-grid { grid-template-columns: 1fr !important; } }
        .cart-remove:hover { color: #f87171 !important; }
        .cart-qty-btn:hover { background: rgba(56,189,248,0.1) !important; }
        .cart-checkout:hover { background: #0ea5e9 !important; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem,3vw,1.9rem)', fontWeight: 900, margin: '0 0 0.2rem', letterSpacing: '-0.5px' }}>Your Cart</h1>
            <p style={{ color: muted, margin: 0, fontSize: '0.85rem' }}>{cart.length} {cart.length === 1 ? 'item' : 'items'}</p>
          </div>
          <Link href="/products" style={{ color: accent, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none' }}>← Continue shopping</Link>
        </div>

        <div className="cart-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.75rem', alignItems: 'start' }}>

          {/* ── Item list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cart.map(item => (
              <div key={item.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                {/* Image */}
                <Link href={`/products/${item.id}`}>
                  <div style={{ width: 84, height: 84, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `1px solid ${border}`, background: '#0f172a' }}>
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                </Link>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/products/${item.id}`} style={{ color: text, textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', display: 'block', marginBottom: 4, lineHeight: 1.3 }}>
                    {item.title}
                  </Link>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: accent, marginBottom: '0.75rem' }}>
                    {fmt(item.price * item.qty, item.currency)}
                  </div>

                  {/* Qty controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden' }}>
                      <button className="cart-qty-btn" onClick={() => updateQty(item.id, -1)} style={{ width: 32, height: 32, background: 'none', border: 'none', color: text, cursor: 'pointer', fontSize: '1rem', transition: 'background 0.15s' }}>−</button>
                      <span style={{ width: 32, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>{item.qty}</span>
                      <button className="cart-qty-btn" onClick={() => updateQty(item.id, 1)} style={{ width: 32, height: 32, background: 'none', border: 'none', color: text, cursor: 'pointer', fontSize: '1rem', transition: 'background 0.15s' }}>+</button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: muted }}>{fmt(item.price, item.currency)} each</span>
                    <button className="cart-remove" onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600, marginLeft: 'auto', transition: 'color 0.15s', padding: 0 }}>
                      🗑 Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Order summary ── */}
          <div style={{ position: 'sticky', top: 112, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1.25rem', letterSpacing: '-0.3px' }}>Order Summary</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted }}>
                  <span>Subtotal</span>
                  <span>{fmt(subtotal, currency)}</span>
                </div>
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399' }}>
                    <span>Promo (FOUNDING25)</span>
                    <span>-{fmt(discount, currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted }}>
                  <span>Shipping</span>
                  <span>{shipping === 0 ? <span style={{ color: '#34d399' }}>Free</span> : fmt(shipping, currency)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: muted }}>
                  <span>FreeTrust fee ({TRUST_FEE_PCT}%)</span>
                  <span>{fmt(fee, currency)}</span>
                </div>
                <div style={{ borderTop: `1px solid ${border}`, paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '1.1rem', color: text }}>
                  <span>Total</span>
                  <span>{fmt(total, currency)}</span>
                </div>
              </div>

              {/* Free shipping nudge */}
              {shipping > 0 && (
                <div style={{ background: 'rgba(56,189,248,0.06)', border: `1px solid rgba(56,189,248,0.15)`, borderRadius: 8, padding: '0.6rem 0.85rem', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '1rem' }}>
                  Add <strong style={{ color: accent }}>{fmt(FREE_SHIPPING_THRESHOLD - afterDiscount, currency)}</strong> more for free shipping
                </div>
              )}

              {/* Promo code */}
              {!promoApplied && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      value={promoCode}
                      onChange={e => { setPromoCode(e.target.value); setPromoError('') }}
                      placeholder="Promo code"
                      style={{ flex: 1, background: '#0f172a', border: `1px solid ${border}`, borderRadius: 8, padding: '0.55rem 0.75rem', color: text, fontSize: '0.82rem', outline: 'none', fontFamily: 'system-ui' }}
                    />
                    <button onClick={applyPromo} style={{ background: 'rgba(56,189,248,0.1)', border: `1px solid ${border}`, color: accent, borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                      Apply
                    </button>
                  </div>
                  {promoError && <div style={{ color: '#f87171', fontSize: '0.72rem', marginTop: 4 }}>{promoError}</div>}
                  <div style={{ color: muted, fontSize: '0.68rem', marginTop: 4 }}>Try: FOUNDING25 for 25% off</div>
                </div>
              )}
              {promoApplied && (
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.55rem 0.85rem', fontSize: '0.78rem', color: '#34d399', fontWeight: 600, marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>✓ FOUNDING25 applied (25% off)</span>
                  <button onClick={() => { setPromoApplied(false); setPromoCode('') }} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.75rem', opacity: 0.7 }}>×</button>
                </div>
              )}

              {/* Checkout button */}
              <button className="cart-checkout" onClick={handleCheckout} disabled={checkoutLoading} style={{ width: '100%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', border: 'none', borderRadius: 12, padding: '1rem', fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(56,189,248,0.3)', transition: 'background 0.2s' }}>
                {checkoutLoading ? 'Processing…' : `Checkout · ${fmt(total, currency)}`}
              </button>

              {/* Trust badges */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                {['🛡️ Escrow Protected', '🔒 Secure Checkout', '↩️ Easy Returns'].map(b => (
                  <span key={b} style={{ fontSize: '0.68rem', color: muted }}>{b}</span>
                ))}
              </div>
            </div>

            {/* Escrow explainer */}
            <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 12, padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#34d399', marginBottom: 4 }}>🛡️ FreeTrust Escrow</div>
              <div style={{ fontSize: '0.72rem', color: muted, lineHeight: 1.55 }}>
                Your payment is held securely and only released to the seller once you confirm receipt. If something goes wrong, we step in. <Link href="/impact" style={{ color: accent }}>Learn more</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
