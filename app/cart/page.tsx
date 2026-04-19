'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

const AppleGooglePayButton = dynamic(() => import('@/components/payments/AppleGooglePayButton'), { ssr: false })

type CartItem = { id: string; title: string; price: number; currency: string; qty: number; image: string }

function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('ft_cart') || '[]') } catch { return [] }
}
function saveCart(c: CartItem[]) {
  localStorage.setItem('ft_cart', JSON.stringify(c))
  window.dispatchEvent(new Event('ft-cart-updated'))
}

function fmt(p: number, cur: string) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(p)
}

const TRUST_FEE_PCT = 5
const FREE_SHIPPING_THRESHOLD = 50 // €50

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [mounted, setMounted] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)
  const [promoError, setPromoError] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

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
    try {
      // Build a combined cart checkout session
      const firstItem = cart[0]
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName: cart.length === 1
            ? firstItem.title
            : `FreeTrust Order (${cart.length} items)`,
          itemDescription: cart.map(i => `${i.title} ×${i.qty}`).join(', '),
          amountInCents: Math.round(total * 100),
          type: 'product',
          sellerId: 'platform', // cart orders go through platform
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        // Payments not yet configured — go to success stub
        router.push('/checkout/success')
      }
    } catch {
      router.push('/checkout/success')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Calculations
  const currency = cart[0]?.currency ?? 'GBP'
  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const discount = promoApplied ? Math.round(subtotal * 0.25) : 0
  const afterDiscount = subtotal - discount
  const shipping = afterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : 4.99
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
    <main style={{ minHeight: '100vh', background: bg, paddingTop: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: muted, fontSize: '0.9rem' }}>Loading cart…</div>
    </main>
  )

  if (cart.length === 0) return (
    <main style={{ minHeight: '100vh', background: bg, color: text, fontFamily: 'system-ui, sans-serif', paddingTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.25rem' }}>
      <div style={{ fontSize: '4rem' }}>🛒</div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0 }}>Your cart is empty</h1>
      <p style={{ color: muted, margin: 0 }}>Add some products to get started.</p>
      <Link href="/products" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.85rem 2rem', borderRadius: 12, fontWeight: 800, textDecoration: 'none', fontSize: '0.95rem' }}>
        Browse Products →
      </Link>
    </main>
  )

  return (
    <main
      className="cart-main"
      style={{
        minHeight:    '100vh',
        background:   bg,
        color:        text,
        fontFamily:   'system-ui, sans-serif',
        paddingTop:   64,
        // Desktop: just enough bottom padding for the footer.
        // Mobile: extra space so content isn't hidden behind the
        // sticky checkout bar — the @media rule below adds 96px
        // plus env(safe-area-inset-bottom) on iOS.
        paddingBottom: 80,
        overflowX:    'hidden', // belt-and-braces — no stray element can cause horizontal scroll
        maxWidth:     '100%',
      }}
    >
      <style>{`
        /* ── Grid ── */
        /* Desktop two-column (items + sticky summary sidebar),
           collapses to a single stacked column below 900px.
           minmax(0, ...) on both tracks prevents a long line
           in an item title from blowing the track out and
           causing horizontal scroll. */
        .cart-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 360px);
          gap: 1.75rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .cart-grid { grid-template-columns: minmax(0, 1fr) !important; }
          /* Sticky no longer makes sense when the summary is a
             stacked block below the items — force static so it
             scrolls with the page. */
          .cart-summary-col { position: static !important; }
          /* Reserve room for the mobile sticky checkout bar + iOS
             home indicator safe area. 96 px is the bar height +
             a little breathing room. */
          .cart-main {
            padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)) !important;
          }
        }

        /* ── Hover states ── */
        .cart-remove:hover   { color: #f87171 !important; }
        .cart-qty-btn:hover  { background: rgba(56,189,248,0.1) !important; }
        .cart-checkout:hover { background: #0ea5e9 !important; }

        /* ── Item card actions row ── */
        /* Quantity stepper + unit price + Remove — wrap onto the
           next line below ~360 px so Remove never collides with the
           quantity pill at 375 px viewport. */
        .cart-actions-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          row-gap: 0.5rem;
        }

        /* ── Product image ── */
        /* 72 px on mobile, 84 px on desktop — keeps the two-column
           card layout readable at 375 px without making the title
           column tiny. */
        .cart-item-image {
          width: 72px; height: 72px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          border: 1px solid rgba(56,189,248,0.1);
          background: #0f172a;
        }
        @media (min-width: 480px) {
          .cart-item-image { width: 84px; height: 84px; }
        }

        /* ── Mobile sticky checkout bar ── */
        /* Fixed to the viewport bottom below 900 px. Sits above
           everything else so it stays tappable while the user
           scrolls through items. iOS home-indicator safe area
           is reserved via env(safe-area-inset-bottom). */
        .cart-mobile-sticky {
          display: none;
          position: fixed;
          left: 0; right: 0; bottom: 0;
          background: #111827;
          border-top: 1px solid rgba(56,189,248,0.2);
          padding: 0.75rem 1rem;
          padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
          align-items: center;
          gap: 0.75rem;
          z-index: 50;
          box-shadow: 0 -6px 24px rgba(0,0,0,0.35);
        }
        @media (max-width: 900px) {
          .cart-mobile-sticky { display: flex; }
        }
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

        <div className="cart-grid">

          {/* ── Item list ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}>
            {cart.map(item => (
              <div key={item.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 14, padding: '1rem', display: 'flex', gap: '0.85rem', alignItems: 'flex-start', minWidth: 0 }}>
                {/* Image — responsive 72/84 px via CSS class above */}
                <Link href={`/products/${item.id}`}>
                  <div className="cart-item-image">
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                </Link>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/products/${item.id}`} style={{ color: text, textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', display: 'block', marginBottom: 4, lineHeight: 1.3, wordBreak: 'break-word' }}>
                    {item.title}
                  </Link>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: accent, marginBottom: '0.75rem' }}>
                    {fmt(item.price * item.qty, item.currency)}
                  </div>

                  {/* Qty controls — 44 px touch-friendly buttons,
                      wraps below the price on narrow screens so
                      "X.XX each" + Remove never push off-screen. */}
                  <div className="cart-actions-row">
                    <div style={{ display: 'flex', alignItems: 'center', border: `1px solid ${border}`, borderRadius: 10, overflow: 'hidden' }}>
                      <button
                        type="button"
                        className="cart-qty-btn"
                        onClick={() => updateQty(item.id, -1)}
                        aria-label={`Decrease quantity of ${item.title}`}
                        style={{ width: 44, height: 44, background: 'none', border: 'none', color: text, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, transition: 'background 0.15s' }}
                      >−</button>
                      <span style={{ width: 44, textAlign: 'center', fontSize: '0.9rem', fontWeight: 700 }} aria-label={`Quantity: ${item.qty}`}>{item.qty}</span>
                      <button
                        type="button"
                        className="cart-qty-btn"
                        onClick={() => updateQty(item.id, 1)}
                        aria-label={`Increase quantity of ${item.title}`}
                        style={{ width: 44, height: 44, background: 'none', border: 'none', color: text, cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, transition: 'background 0.15s' }}
                      >+</button>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: muted }}>{fmt(item.price, item.currency)} each</span>
                    <button
                      type="button"
                      className="cart-remove"
                      onClick={() => removeItem(item.id)}
                      aria-label={`Remove ${item.title} from cart`}
                      style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, marginLeft: 'auto', transition: 'color 0.15s', padding: '0.5rem 0.25rem', minHeight: 44, display: 'inline-flex', alignItems: 'center' }}
                    >
                      🗑 Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Order summary ── */}
          <div
            className="cart-summary-col"
            style={{ position: 'sticky', top: 112, display: 'flex', flexDirection: 'column', gap: '1rem', minWidth: 0 }}
          >
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
                      style={{ flex: 1, minWidth: 0, background: '#0f172a', border: `1px solid ${border}`, borderRadius: 8, padding: '0.65rem 0.75rem', color: text, fontSize: '16px', outline: 'none', fontFamily: 'system-ui' }}
                    />
                    <button type="button" onClick={applyPromo} style={{ background: 'rgba(56,189,248,0.1)', border: `1px solid ${border}`, color: accent, borderRadius: 8, padding: '0.65rem 0.9rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
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
                  <button type="button" onClick={() => { setPromoApplied(false); setPromoCode('') }} style={{ background: 'none', border: 'none', color: '#34d399', cursor: 'pointer', fontSize: '0.95rem', opacity: 0.7, padding: '0.25rem 0.5rem', minHeight: 32 }}>×</button>
                </div>
              )}

              {/* Apple Pay / Google Pay express checkout */}
              {cart.length > 0 && total > 0 && (
                <>
                  <AppleGooglePayButton
                    amountCents={Math.round(total * 100)}
                    currency={currency.toUpperCase()}
                    label={`FreeTrust Order (${cart.length} item${cart.length > 1 ? 's' : ''})`}
                    description={cart.map(i => `${i.title} ×${i.qty}`).join(', ').slice(0, 200)}
                    metadata={{ type: 'cart_checkout', item_count: String(cart.length) }}
                    onSuccess={(piId) => {
                      setPayError(null)
                      localStorage.removeItem('ft_cart')
                      window.dispatchEvent(new Event('ft-cart-updated'))
                      router.push(`/checkout/success?payment_intent=${piId}`)
                    }}
                    onError={(msg) => setPayError(msg)}
                    style={{ marginBottom: 8 }}
                  />
                  {payError && (
                    <div style={{ color: '#f87171', fontSize: '0.72rem', marginBottom: 8 }}>{payError}</div>
                  )}
                </>
              )}

              {/* Checkout button — 52 px tall, full width */}
              <button
                type="button"
                className="cart-checkout"
                onClick={handleCheckout}
                disabled={checkoutLoading}
                style={{ width: '100%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', border: 'none', borderRadius: 12, padding: '1rem', minHeight: 52, fontWeight: 800, fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 20px rgba(56,189,248,0.3)', transition: 'background 0.2s' }}
              >
                {checkoutLoading ? 'Processing…' : `Checkout · ${fmt(total, currency)}`}
              </button>

              {/* Trust badges */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
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

      {/* ── Mobile sticky checkout bar ── */}
      {/* Only visible below 900 px (see CSS). Shows the running
          total + a full-tap-target checkout button so the buyer
          never has to scroll to find it. Accounts for iOS home
          indicator via env(safe-area-inset-bottom). */}
      <div className="cart-mobile-sticky" role="region" aria-label="Cart checkout">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.7rem', color: muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
          <div style={{ fontSize: '1.15rem', fontWeight: 900, color: text, lineHeight: 1.1 }}>
            {fmt(total, currency)}
          </div>
        </div>
        <button
          type="button"
          onClick={handleCheckout}
          disabled={checkoutLoading}
          style={{
            background:   'linear-gradient(135deg,#38bdf8,#0284c7)',
            color:        '#fff',
            border:       'none',
            borderRadius: 10,
            padding:      '0 1.25rem',
            minHeight:    48,
            fontSize:     '0.92rem',
            fontWeight:   800,
            cursor:       'pointer',
            flexShrink:   0,
            opacity:      checkoutLoading ? 0.7 : 1,
          }}
          aria-label={`Proceed to checkout, total ${fmt(total, currency)}`}
        >
          {checkoutLoading ? 'Processing…' : 'Checkout →'}
        </button>
      </div>
    </main>
  )
}
