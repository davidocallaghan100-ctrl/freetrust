"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

interface SessionSummary {
  itemName: string;
  amountTotal: number;
  platformFeeAmount: number;
  platformFeeRate: number;
  type: string;
  currency: string;
}

export default function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    async function fetchSession() {
      try {
        const res = await fetch(`/api/checkout/session?session_id=${sessionId}`);
        if (res.ok) setSummary(await res.json());
      } catch { /* silent — show fallback */ }
      finally { setLoading(false); }
    }
    fetchSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ fontSize: 13, color: '#64748b' }}>Loading order details…</div>
        </div>
      </div>
    );
  }

  const sym = summary?.currency === 'gbp' ? '£' : summary?.currency === 'eur' ? '€' : '$';
  const feeLabel = summary?.type === 'service' ? '8% service fee' : '5% product fee';
  const amountDisplay = summary ? `${sym}${(summary.amountTotal / 100).toFixed(2)}` : '';
  const feeDisplay = summary ? `${sym}${(summary.platformFeeAmount / 100).toFixed(2)}` : '';
  const sellerReceives = summary ? `${sym}${((summary.amountTotal - summary.platformFeeAmount) / 100).toFixed(2)}` : '';

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes pop { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.15) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes ripple { 0% { transform: scale(1); opacity: 0.6 } 100% { transform: scale(2.2); opacity: 0 } }
      `}</style>

      <div style={{ width: '100%', maxWidth: 440, animation: 'fadeUp 0.4s ease' }}>

        {/* Success icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
          <div style={{ position: 'relative', width: 88, height: 88 }}>
            {/* Ripple rings */}
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(52,211,153,0.15)', animation: 'ripple 1.6s ease-out infinite' }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(52,211,153,0.1)', animation: 'ripple 1.6s ease-out 0.4s infinite' }} />
            {/* Circle */}
            <div style={{ position: 'relative', width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg, #34d399, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 6px rgba(52,211,153,0.15)', animation: 'pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275) 0.1s both' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        </div>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Payment Successful!</h1>
          <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6, margin: 0, maxWidth: 320, marginInline: 'auto' }}>
            Your payment is held securely in escrow. Funds release to the seller once you confirm delivery.
          </p>
        </div>

        {/* Escrow status banner */}
        <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(52,211,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔒</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>Escrow Protection Active</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Funds are protected until you confirm receipt</div>
          </div>
        </div>

        {/* Order summary card */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #334155' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Order Summary</div>
          </div>

          {summary ? (
            <div style={{ padding: '4px 0' }}>
              {/* Item */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(51,65,85,0.6)' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Item</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', maxWidth: 220, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{summary.itemName}</span>
              </div>
              {/* Total paid */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(51,65,85,0.6)' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Total Paid</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>{amountDisplay}</span>
              </div>
              {/* Platform fee */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(51,65,85,0.6)' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Platform fee ({feeLabel})</span>
                <span style={{ fontSize: 13, color: '#64748b' }}>−{feeDisplay}</span>
              </div>
              {/* Seller receives */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Seller receives</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#34d399' }}>{sellerReceives}</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[80, 60, 70, 50].map((w, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ height: 12, width: `${w}%`, background: 'linear-gradient(90deg,#1e293b 25%,#243047 50%,#1e293b 75%)', backgroundSize: '200%', animation: 'shimmer 1.5s infinite', borderRadius: 6 }} />
                </div>
              ))}
              <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
            </div>
          )}
        </div>

        {/* Trust earned callout */}
        <div style={{ background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.18)', borderRadius: 12, padding: '12px 16px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(56,189,248,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💎</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#38bdf8' }}>+₮25 Trust earned</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Completing orders grows your Trust score</div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Link href="/orders" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#0f172a', borderRadius: 12, padding: '14px 20px', fontWeight: 800, fontSize: 15, textDecoration: 'none', textAlign: 'center' }}>
            📦 View My Orders
          </Link>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Link href="/services" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', color: '#38bdf8', borderRadius: 12, padding: '12px', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
              🛠 Services
            </Link>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', color: '#94a3b8', borderRadius: 12, padding: '12px', fontWeight: 700, fontSize: 13, textDecoration: 'none', textAlign: 'center' }}>
              🏠 Home
            </Link>
          </div>
        </div>

        {/* Trust footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#334155' }}>
          🔒 Secured by FreeTrust Escrow · All transactions protected
        </div>
      </div>
    </div>
  );
}
