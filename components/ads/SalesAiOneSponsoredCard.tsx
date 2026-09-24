'use client'

import React from 'react'

type Placement = 'landing' | 'feed-rail' | 'feed-inline'

const SALES_AI_ONE_WEBSITE = 'https://www.salesai.one/'

function referralHref(placement: Placement) {
  const url = new URL(SALES_AI_ONE_WEBSITE)
  url.searchParams.set('utm_source', 'freetrust')
  url.searchParams.set('utm_medium', 'partner_ad')
  url.searchParams.set('utm_campaign', 'freetrust_sponsored_space')
  url.searchParams.set('utm_content', placement)
  return url.toString()
}

function SalesAiOneMark() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 40,
        height: 40,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
        borderRadius: 13,
        color: '#fff',
        background: 'linear-gradient(145deg, #2563eb, #1d4ed8 58%, #172554)',
        border: '1px solid rgba(147,197,253,.42)',
        boxShadow: '0 10px 24px rgba(37,99,235,.28)',
        fontSize: 20,
      }}
    >
      🚀
    </span>
  )
}

export default function SalesAiOneSponsoredCard({ placement }: { placement: Placement }) {
  const compact = placement !== 'landing'
  const href = referralHref(placement)

  return (
    <article
      className={`ft-sao-sponsored-card ft-sao-sponsored-card-${placement}`}
      data-testid={`sao-sponsored-${placement}`}
      data-referral-url={href}
      aria-label="Sponsored partner: Sales AI One"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: compact ? 14 : 22,
        border: '1px solid rgba(56,189,248,.28)',
        background: compact
          ? 'linear-gradient(145deg, rgba(15,23,42,.98), rgba(18,33,64,.92))'
          : 'linear-gradient(145deg, rgba(8,19,40,.98), rgba(15,35,64,.94) 58%, rgba(10,22,45,.98))',
        boxShadow: compact ? '0 14px 34px rgba(2,6,23,.18)' : '0 24px 72px rgba(2,6,23,.32), inset 0 1px 0 rgba(255,255,255,.05)',
        color: '#f8fafc',
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', width: compact ? 150 : 330, height: compact ? 150 : 330, right: compact ? -72 : -110, top: compact ? -82 : -170, borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,.26), transparent 68%)', pointerEvents: 'none' }} />
      <div aria-hidden="true" style={{ position: 'absolute', width: compact ? 120 : 260, height: compact ? 120 : 260, left: compact ? -95 : -150, bottom: compact ? -92 : -160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(45,212,191,.12), transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, padding: compact ? '1rem' : '1.35rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: compact ? 12 : 18 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#7dd3fc', fontSize: 10, letterSpacing: '.13em', textTransform: 'uppercase', fontWeight: 900 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: '#34d399', boxShadow: '0 0 0 4px rgba(52,211,153,.12)' }} />
            Sponsored partner
          </div>
          <span style={{ color: 'rgba(226,232,240,.56)', fontSize: 10, whiteSpace: 'nowrap' }}>Why am I seeing this?</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: compact ? 10 : 14 }}>
          <SalesAiOneMark />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: '#bfdbfe', fontSize: 11, fontWeight: 800, letterSpacing: '.02em', marginBottom: 4 }}>Sales AI One</div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: compact ? 18 : 'clamp(1.55rem, 3vw, 2.15rem)', lineHeight: 1.08, letterSpacing: '-.04em', fontWeight: 900 }}>
              Get sales for your offering
            </h2>
          </div>
        </div>

        <p style={{ margin: compact ? '12px 0 15px' : '14px 0 20px', color: '#cbd5e1', fontSize: compact ? 12 : 15, lineHeight: 1.55, maxWidth: compact ? 250 : 590 }}>
          Sales AI One helps founders find leads, follow up, and close more deals.
        </p>

        <a
          href={href}
          target="_blank"
          rel="sponsored nofollow noopener"
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: compact ? 38 : 44, width: compact ? '100%' : 'auto', padding: compact ? '0 14px' : '0 19px', borderRadius: 10, background: 'linear-gradient(135deg,#3b82f6,#2563eb)', color: '#fff', fontSize: compact ? 12 : 13, fontWeight: 850, textDecoration: 'none', boxShadow: '0 10px 24px rgba(37,99,235,.24)' }}
        >
          Explore Sales AI One <span aria-hidden="true" style={{ marginLeft: 7 }}>↗</span>
        </a>
      </div>
    </article>
  )
}
