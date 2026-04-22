// app/not-found.tsx — Custom 404 page
import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* Icon */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'linear-gradient(135deg, #13131a, #1e1e2e)',
        border: '1px solid #2a2a3a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 24,
        boxShadow: '0 0 30px rgba(56,189,248,0.15)',
      }}>🔍</div>

      {/* Heading */}
      <h1 style={{
        fontSize: 22, fontWeight: 800, margin: '0 0 10px',
        background: 'linear-gradient(135deg, #f1f5f9, #38bdf8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>Page not found</h1>

      <p style={{
        fontSize: 14, color: '#64748b', margin: '0 0 32px', maxWidth: 280, lineHeight: 1.6,
      }}>
        This page doesn&apos;t exist or may have been removed.
      </p>

      {/* CTAs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300, position: 'relative', zIndex: 200 }}>
        <Link href="/feed" style={{
          display: 'block', padding: '14px 24px', borderRadius: 12,
          background: 'linear-gradient(135deg, #00d4aa, #38bdf8)',
          color: '#0a0a0f', fontWeight: 700, fontSize: 15,
          textDecoration: 'none', textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,212,170,0.35)',
        }}>Go to Feed</Link>

        <Link href="/jobs" style={{
          display: 'block', padding: '14px 24px', borderRadius: 12,
          background: 'transparent', border: '1.5px solid #2a2a3a',
          color: '#f1f5f9', fontWeight: 600, fontSize: 15,
          textDecoration: 'none', textAlign: 'center',
        }}>Browse Jobs →</Link>

        <Link href="/" style={{
          display: 'block', padding: '10px',
          color: '#64748b', fontSize: 13,
          textDecoration: 'none', textAlign: 'center',
        }}>← Back to home</Link>
      </div>
    </div>
  )
}
