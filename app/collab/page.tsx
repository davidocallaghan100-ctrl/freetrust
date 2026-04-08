'use client'
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const SECTIONS = [
  {
    href: '/collab/marketplace',
    emoji: '🛒',
    title: 'Buy & Sell',
    desc: 'Browse verified products from trusted sellers. Filter by Trust score to shop with confidence.',
    color: '#38bdf8',
    bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)',
    stats: 'Products from verified members',
  },
  {
    href: '/collab/services',
    emoji: '🎯',
    title: 'Services',
    desc: 'Find skilled freelancers and service providers. Every provider has a verifiable Trust history.',
    color: '#a78bfa',
    bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)',
    stats: 'Expert services available',
  },
  {
    href: '/collab/events',
    emoji: '📅',
    title: 'Events',
    desc: 'Attend workshops, meetups, and online events hosted by community members.',
    color: '#34d399',
    bg: 'linear-gradient(135deg,#10b981,#059669)',
    stats: 'Upcoming community events',
  },
  {
    href: '/collab/people',
    emoji: '🤝',
    title: 'Find Collaborators',
    desc: 'Connect with founders, makers, and experts who share your vision. Filter by Trust level.',
    color: '#fbbf24',
    bg: 'linear-gradient(135deg,#f59e0b,#d97706)',
    stats: 'Members ready to collaborate',
  },
]

type ModalOption = 'product' | 'service' | 'event' | null

export default function CollabPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)

  function handleOption(option: ModalOption) {
    setShowModal(false)
    if (option === 'product') router.push('/seller/gigs/create')
    if (option === 'service') router.push('/seller/gigs/create')
    if (option === 'event') router.push('/events/create')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      <style>{`
        .collab-card {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 32px;
          cursor: pointer;
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
          text-decoration: none;
          display: block;
          color: inherit;
        }
        .collab-card:hover {
          transform: translateY(-4px);
          border-color: #475569;
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        .modal-box {
          background: #1e293b;
          border: 1px solid #334155;
          border-radius: 20px;
          padding: 32px;
          width: 90%;
          max-width: 420px;
          box-shadow: 0 25px 60px rgba(0,0,0,0.5);
        }
        .modal-option {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid #334155;
          cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          margin-bottom: 12px;
          background: #0f172a;
        }
        .modal-option:hover {
          background: #1e3a5f;
          border-color: #38bdf8;
        }
        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.3);
          border-radius: 100px;
          padding: 6px 16px;
          font-size: 13px;
          color: #38bdf8;
          margin-bottom: 24px;
        }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>

        {/* Hero */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 48 }}>
          <div>
            <div className="hero-badge">
              <span>✦</span>
              <span>Trust-Powered Collaboration</span>
            </div>
            <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 700, color: '#f1f5f9', margin: '0 0 12px', lineHeight: 1.2 }}>
              Collab Hub
            </h1>
            <p style={{ fontSize: 16, color: '#94a3b8', maxWidth: 520, margin: 0, lineHeight: 1.6 }}>
              Buy, sell, and connect with verified community members. Every interaction is backed by real Trust scores — so you always know who you're working with.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'linear-gradient(135deg,#38bdf8,#0284c7)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '12px 24px',
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            List Something
          </button>
        </div>

        {/* Section cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="collab-card">
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: s.bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                marginBottom: 20,
                boxShadow: `0 8px 24px rgba(0,0,0,0.3)`,
              }}>
                {s.emoji}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9', margin: '0 0 8px' }}>{s.title}</h2>
              <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6, margin: '0 0 20px' }}>{s.desc}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 12,
                  color: s.color,
                  background: `${s.color}1a`,
                  padding: '3px 10px',
                  borderRadius: 100,
                  border: `1px solid ${s.color}33`,
                }}>
                  {s.stats}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 16,
                color: s.color,
                fontSize: 14,
                fontWeight: 500,
              }}>
                Explore <span style={{ marginLeft: 4 }}>→</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Trust filter promo */}
        <div style={{
          marginTop: 48,
          background: 'linear-gradient(135deg,rgba(56,189,248,0.08),rgba(14,165,233,0.04))',
          border: '1px solid rgba(56,189,248,0.2)',
          borderRadius: 16,
          padding: '28px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}>
          <div style={{ fontSize: 40 }}>₮</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>Filter by Trust Score</h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14, lineHeight: 1.6 }}>
              Every listing, service, and member in the Collab Hub can be filtered by Trust score. The higher the score, the more vouches and positive interactions that person has earned from the community.
            </p>
          </div>
          <Link href="/wallet" style={{
            background: 'rgba(56,189,248,0.1)',
            border: '1px solid rgba(56,189,248,0.3)',
            color: '#38bdf8',
            borderRadius: 10,
            padding: '10px 20px',
            textDecoration: 'none',
            fontSize: 14,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}>
            Check your Trust →
          </Link>
        </div>
      </div>

      {/* Quick List Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>List Something</h2>
            <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>What do you want to offer?</p>

            <div className="modal-option" onClick={() => handleOption('product')}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg,#38bdf8,#0284c7)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>📦</div>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>List a Product</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Sell physical or digital goods</div>
              </div>
            </div>

            <div className="modal-option" onClick={() => handleOption('service')}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>🎯</div>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>Offer a Service</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Freelance skills and expertise</div>
              </div>
            </div>

            <div className="modal-option" onClick={() => handleOption('event')}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'linear-gradient(135deg,#34d399,#059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
              }}>📅</div>
              <div>
                <div style={{ fontWeight: 600, color: '#f1f5f9', marginBottom: 2 }}>Host an Event</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Online or in-person events</div>
              </div>
            </div>

            <button
              onClick={() => setShowModal(false)}
              style={{
                width: '100%', marginTop: 8, padding: '12px', background: 'transparent',
                border: '1px solid #334155', borderRadius: 10, color: '#64748b',
                cursor: 'pointer', fontSize: 14,
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
