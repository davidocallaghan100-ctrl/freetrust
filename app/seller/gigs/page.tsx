import Link from 'next/link'

// ────────────────────────────────────────────────────────────────────────────
// /seller/gigs — minimal dashboard stub
// ────────────────────────────────────────────────────────────────────────────
// This page exists purely so the URL /seller/gigs is never a dead 404.
// The old gig create flow at /seller/gigs/create used to redirect here
// after a fake publish, and the absence of this file is what caused the
// "404 when adding a gig" bug report.
//
// The publish flow now redirects to /services?published=true instead
// (see app/seller/gigs/create/page.tsx handlePublish), but this page
// still needs to exist for two reasons:
//
//   1. Sidebar and similar navigation may link here in the future
//      for a real seller dashboard — it's a reserved slot.
//   2. Typing the URL directly, or any stale link in the wild, should
//      land on something useful, not a 404.
//
// Expanded functionality (edit/delete existing gigs, stats, payouts)
// lives in follow-up commits once the services schema grows the columns
// needed to support tiered packages, delivery types, etc.

export const metadata = {
  title: 'Your Gigs — FreeTrust',
  description: 'Manage the gigs you sell on FreeTrust.',
}

export default function SellerGigsPage() {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 58px)',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        paddingTop: 104,
        paddingBottom: 80,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {/* Header */}
        <h1
          style={{
            fontSize: 'clamp(1.8rem, 5vw, 2.4rem)',
            fontWeight: 900,
            margin: '0 0 0.75rem',
            letterSpacing: '-0.5px',
          }}
        >
          🎯 Your Gigs
        </h1>
        <p
          style={{
            color: '#94a3b8',
            fontSize: '1rem',
            lineHeight: 1.6,
            margin: '0 0 2rem',
            maxWidth: 520,
          }}
        >
          Gig management is coming soon. For now you can create new gigs and
          browse live ones on the Services marketplace.
        </p>

        {/* Coming-soon card */}
        <div
          style={{
            background: '#1e293b',
            border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 14,
            padding: '1.75rem',
            marginBottom: '1.25rem',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#64748b',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            What&apos;s coming
          </div>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              color: '#cbd5e1',
              fontSize: '0.92rem',
              lineHeight: 1.55,
            }}
          >
            <li>📊 Active listings overview with view + order stats</li>
            <li>✏️ Inline edit for title, description, price, and packages</li>
            <li>⏸ Pause or archive a gig without deleting it</li>
            <li>💰 Earnings summary linked to your Stripe Connect payouts</li>
          </ul>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link
            href="/services"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 22px',
              background: '#38bdf8',
              color: '#0f172a',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 800,
              textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(56,189,248,0.28)',
            }}
          >
            Browse the Services marketplace →
          </Link>
          <Link
            href="/seller/gigs/create"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '12px 22px',
              background: 'transparent',
              border: '1px solid rgba(56,189,248,0.35)',
              color: '#38bdf8',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            + Create another gig
          </Link>
        </div>
      </div>
    </div>
  )
}
