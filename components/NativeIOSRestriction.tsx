'use client'

export default function NativeIOSRestriction({ feature }: { feature: string }) {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--ft-bg)', color: 'var(--ft-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 440, textAlign: 'center', background: 'var(--ft-surface)', border: '1px solid var(--ft-border-strong)', borderRadius: 20, padding: '30px 22px', boxShadow: '0 18px 50px rgba(0,0,0,.22)' }}>
        <div style={{ fontSize: 42, marginBottom: 12 }}>🌐</div>
        <h1 style={{ margin: '0 0 10px', fontSize: 22 }}>Available on FreeTrust web</h1>
        <p style={{ margin: '0 auto', maxWidth: 360, color: 'var(--ft-text-secondary)', lineHeight: 1.55, fontSize: 14 }}>
          {feature} is available at freetrust.co in a web browser. The iOS app focuses on browsing physical goods and booking real-world services.
        </p>
        <a href="https://freetrust.co" style={{ display: 'inline-flex', marginTop: 22, minHeight: 42, alignItems: 'center', justifyContent: 'center', padding: '0 18px', borderRadius: 10, background: 'linear-gradient(135deg,var(--ft-accent),#0284c7)', color: '#fff', fontWeight: 800, textDecoration: 'none' }}>
          Continue to FreeTrust
        </a>
      </section>
    </main>
  )
}
