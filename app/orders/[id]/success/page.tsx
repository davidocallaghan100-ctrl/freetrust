'use client'
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function SuccessContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const orderId = params.id as string
  const sessionId = searchParams.get('session_id')

  const [showConfetti, setShowConfetti] = useState(false)

  useEffect(() => {
    setShowConfetti(true)
    const t = setTimeout(() => setShowConfetti(false), 3000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <style>{`
        @keyframes popIn {
          0% { transform: scale(0.8); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(-80px) rotate(360deg); opacity: 0; }
        }
        .confetti-item { position: absolute; animation: confetti 1.5s ease-out forwards; }
        @media (max-width: 480px) {
          .success-btns { flex-direction: column !important; }
        }
      `}</style>

      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', animation: 'popIn 0.5s ease-out both' }}>
        {/* Success icon */}
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '1.5rem' }}>
          <div style={{
            width: 100, height: 100, borderRadius: '50%',
            background: 'linear-gradient(135deg, #34d399, #059669)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '3rem', margin: '0 auto',
            boxShadow: '0 0 0 16px rgba(52,211,153,0.1)',
          }}>
            ✅
          </div>
          {showConfetti && ['₮', '⭐', '🎉', '✨', '₮'].map((item, i) => (
            <span key={i} className="confetti-item" style={{
              top: '50%', left: `${20 + i * 16}%`,
              fontSize: '1.2rem',
              animationDelay: `${i * 0.15}s`,
            }}>
              {item}
            </span>
          ))}
        </div>

        {/* Heading */}
        <h1 style={{ fontSize: '2rem', fontWeight: 900, margin: '0 0 0.5rem', color: '#f1f5f9' }}>
          Order Confirmed! 🎉
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1rem', marginBottom: '2rem', lineHeight: 1.6 }}>
          Your payment is securely held in escrow. The seller will be notified and your order is now in progress.
        </p>

        {/* Trust reward badge */}
        <div style={{
          background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '2rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
        }}>
          <div style={{ fontSize: '2rem' }}>₮</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: 800, color: '#38bdf8', fontSize: '1.1rem' }}>+₮5 Trust Earned!</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Credited to your wallet for this purchase</div>
          </div>
        </div>

        {/* Order ID */}
        <div style={{
          background: '#1e293b', borderRadius: 10, padding: '0.875rem 1.25rem',
          marginBottom: '2rem', border: '1px solid rgba(148,163,184,0.1)',
        }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Order Reference</div>
          <div style={{ fontFamily: 'monospace', color: '#f1f5f9', fontWeight: 600, letterSpacing: '0.05em', fontSize: '0.9rem' }}>
            #{orderId.slice(0, 8).toUpperCase()}
          </div>
        </div>

        {/* What happens next */}
        <div style={{ background: '#1e293b', borderRadius: 12, padding: '1.25rem', marginBottom: '2rem', textAlign: 'left', border: '1px solid rgba(148,163,184,0.1)' }}>
          <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: '0.75rem', fontSize: '0.9rem' }}>What happens next?</div>
          {[
            { step: '1', text: 'Seller is notified and begins working on your order' },
            { step: '2', text: 'Seller marks the order as delivered when complete' },
            { step: '3', text: 'You review the delivery and release payment from escrow' },
            { step: '4', text: 'Seller receives payment and you earn ₮10 trust on completion' },
          ].map(item => (
            <div key={item.step} style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: '#38bdf8',
                color: '#0f172a', fontWeight: 800, fontSize: '0.7rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {item.step}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.5 }}>{item.text}</div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="success-btns" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link href={`/orders/${orderId}`} style={{
            flex: 1, textDecoration: 'none', padding: '0.875rem',
            background: '#38bdf8', color: '#0f172a', borderRadius: 10, fontWeight: 800,
            fontSize: '0.9rem', textAlign: 'center',
          }}>
            View Order
          </Link>
          <Link href="/services" style={{
            flex: 1, textDecoration: 'none', padding: '0.875rem',
            background: 'rgba(56,189,248,0.1)', color: '#38bdf8', borderRadius: 10, fontWeight: 700,
            fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(56,189,248,0.2)',
          }}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
        Loading...
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
