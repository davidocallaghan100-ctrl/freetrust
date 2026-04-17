import Link from 'next/link';

export default function FounderSuccessPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '80px 20px', textAlign: 'center', color: '#f1f5f9' }}>
      <div style={{ fontSize: 11, letterSpacing: 3, color: '#38bdf8', fontWeight: 500, textTransform: 'uppercase', marginBottom: 14 }}>
        ✦ Payment received
      </div>
      <h1 style={{ fontSize: 40, fontWeight: 600, margin: '0 0 16px' }}>
        Welcome, founder.
      </h1>
      <p style={{ fontSize: 17, color: '#94a3b8', lineHeight: 1.6, marginBottom: 32 }}>
        Your benefits are being applied — AI Credits, TrustCoin bonus, and lifetime lower fees. This usually takes under 30 seconds. You can close this page or head back to FreeTrust.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link
          href="/wallet"
          style={{ padding: '14px 28px', background: '#38bdf8', color: '#0f172a', borderRadius: 12, fontWeight: 600, textDecoration: 'none', fontSize: 15 }}
        >
          See your wallet
        </Link>
        <Link
          href="/agents"
          style={{ padding: '14px 28px', border: '1px solid rgba(148,163,184,0.3)', color: '#f1f5f9', borderRadius: 12, fontWeight: 500, textDecoration: 'none', fontSize: 15 }}
        >
          Try an AI agent
        </Link>
      </div>
    </div>
  );
}
