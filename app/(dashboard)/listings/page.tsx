'use client'

import { useState } from 'react'
import Link from 'next/link'

type Status = 'active' | 'draft' | 'sold' | 'archived'

interface MyListing {
  id: string
  title: string
  category: string
  price: number
  status: Status
  views: number
  sales: number
  revenue: number
  createdAt: string
  logo: string
}

const MY_LISTINGS: MyListing[] = [
  { id: '1', title: 'AuthShield Pro', category: 'Identity', price: 49, status: 'active', views: 1240, sales: 18, revenue: 882, createdAt: '2026-03-10', logo: '🔐' },
  { id: '2', title: 'VaultKey Enterprise', category: 'Encryption', price: 199, status: 'active', views: 830, sales: 7, revenue: 1393, createdAt: '2026-03-22', logo: '🗝️' },
  { id: '3', title: 'QuickAudit Lite', category: 'Audit', price: 0, status: 'draft', views: 0, sales: 0, revenue: 0, createdAt: '2026-04-05', logo: '📜' },
  { id: '4', title: 'PolicyKit Starter', category: 'Access Control', price: 29, status: 'sold', views: 560, sales: 3, revenue: 87, createdAt: '2026-02-14', logo: '⚙️' },
]

const STATUS_COLORS: Record<Status, string> = {
  active: '#10b981',
  draft: '#f59e0b',
  sold: '#3b82f6',
  archived: '#64748b',
}

export default function MyListingsPage() {
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = filter === 'all' ? MY_LISTINGS : MY_LISTINGS.filter(l => l.status === filter)
  const totalRevenue = MY_LISTINGS.reduce((s, l) => s + l.revenue, 0)
  const totalSales = MY_LISTINGS.reduce((s, l) => s + l.sales, 0)
  const totalViews = MY_LISTINGS.reduce((s, l) => s + l.views, 0)

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0f172a; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #f8fafc; }
        .nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; justify-content: space-between; padding: 16px 28px; background: rgba(15,23,42,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(12px); }
        .nav-logo { display: flex; align-items: center; gap: 9px; text-decoration: none; }
        .nav-logo-icon { width: 30px; height: 30px; background: linear-gradient(135deg, #10b981, #3b82f6); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .nav-logo-text { font-size: 17px; font-weight: 700; color: #f8fafc; }
        .nav-logo-text span { color: #10b981; }
        .nav-actions { display: flex; gap: 12px; align-items: center; }
        .nav-link { font-size: 14px; color: #94a3b8; text-decoration: none; padding: 6px 12px; border-radius: 8px; transition: color 0.2s, background 0.2s; }
        .nav-link:hover { color: #f8fafc; background: rgba(255,255,255,0.05); }
        .nav-link.active { color: #10b981; }

        .page { max-width: 1000px; margin: 0 auto; padding: 40px 24px; }
        .page-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 32px; }
        .page-title-block h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; }
        .page-title-block p { font-size: 14px; color: #64748b; margin-top: 3px; }

        /* Summary cards */
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 14px; margin-bottom: 28px; }
        .summary-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 20px; }
        .summary-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 8px; }
        .summary-value { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #10b981; }

        /* Filters */
        .filter-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .filter-chip { padding: 6px 14px; border-radius: 20px; border: 1px solid rgba(100,116,139,0.25); background: transparent; color: #94a3b8; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: inherit; }
        .filter-chip:hover { border-color: rgba(255,255,255,0.2); color: #f8fafc; }
        .filter-chip.active { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.4); color: #10b981; font-weight: 600; }

        /* Listing rows */
        .listing-row { display: flex; align-items: center; gap: 16px; padding: 20px; background: rgba(15,23,42,0.7); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; margin-bottom: 8px; transition: border-color 0.2s, transform 0.15s; flex-wrap: wrap; }
        .listing-row:hover { border-color: rgba(16,185,129,0.2); transform: translateX(2px); }
        .listing-logo { width: 46px; height: 46px; background: rgba(30,41,59,0.9); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
        .listing-main { flex: 1; min-width: 0; }
        .listing-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 3px; }
        .listing-cat { font-size: 12px; color: #64748b; }
        .listing-stats { display: flex; gap: 20px; align-items: center; flex-wrap: wrap; }
        .lstat { text-align: center; min-width: 60px; }
        .lstat-val { font-size: 15px; font-weight: 700; color: #f8fafc; }
        .lstat-label { font-size: 11px; color: #475569; }
        .status-badge { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; border: 1px solid currentColor; white-space: nowrap; }
        .listing-actions { display: flex; gap: 8px; }
        .action-btn { padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer; border: 1px solid rgba(100,116,139,0.25); background: transparent; color: #94a3b8; font-family: inherit; transition: all 0.15s; }
        .action-btn:hover { border-color: rgba(16,185,129,0.4); color: #10b981; background: rgba(16,185,129,0.06); }

        /* Create CTA */
        .create-cta { background: linear-gradient(135deg, rgba(16,185,129,0.07), rgba(59,130,246,0.05)); border: 1px dashed rgba(16,185,129,0.25); border-radius: 14px; padding: 32px; text-align: center; margin-top: 20px; }
        .create-cta h3 { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
        .create-cta p { font-size: 14px; color: #64748b; margin-bottom: 18px; }

        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s, transform 0.15s; text-decoration: none; }
        .btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-green { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
        .btn-outline { background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); color: #cbd5e1; }
        .empty { text-align: center; padding: 48px 20px; color: #475569; }
        .empty-icon { font-size: 36px; margin-bottom: 12px; }
        .empty h3 { font-size: 16px; color: #64748b; margin-bottom: 6px; }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🛡</div>
          <span className="nav-logo-text">Free<span>Trust</span></span>
        </Link>
        <div className="nav-actions">
          <Link href="/browse" className="nav-link">Marketplace</Link>
          <Link href="/listings" className="nav-link active">My Listings</Link>
          <Link href="/wallet" className="nav-link">Wallet</Link>
          <Link href="/profile" className="nav-link">Profile</Link>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <div className="page-title-block">
            <h1>📦 My Listings</h1>
            <p>Manage and track your tools on the marketplace</p>
          </div>
          <button className="btn btn-green" onClick={() => setShowCreate(true)}>
            + New listing
          </button>
        </div>

        {/* Summary */}
        <div className="summary-grid">
          <div className="summary-card">
            <div className="summary-label">Total revenue</div>
            <div className="summary-value">€{totalRevenue.toLocaleString()}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total sales</div>
            <div className="summary-value">{totalSales}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Total views</div>
            <div className="summary-value">{totalViews.toLocaleString()}</div>
          </div>
          <div className="summary-card">
            <div className="summary-label">Active listings</div>
            <div className="summary-value">{MY_LISTINGS.filter(l => l.status === 'active').length}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="filter-row">
          {(['all', 'active', 'draft', 'sold', 'archived'] as const).map(f => (
            <button
              key={f}
              className={`filter-chip${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== 'all' && <span style={{ marginLeft: 4, opacity: 0.7 }}>
                ({MY_LISTINGS.filter(l => l.status === f).length})
              </span>}
            </button>
          ))}
        </div>

        {/* Listings */}
        {filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📦</div>
            <h3>No {filter} listings</h3>
            <p>Try a different filter or create a new listing.</p>
          </div>
        ) : (
          filtered.map(listing => (
            <div key={listing.id} className="listing-row">
              <div className="listing-logo">{listing.logo}</div>
              <div className="listing-main">
                <div className="listing-title">{listing.title}</div>
                <div className="listing-cat">{listing.category} · {listing.price === 0 ? 'Free' : `€${listing.price}`}</div>
              </div>
              <div className="listing-stats">
                <div className="lstat">
                  <div className="lstat-val">{listing.views}</div>
                  <div className="lstat-label">Views</div>
                </div>
                <div className="lstat">
                  <div className="lstat-val">{listing.sales}</div>
                  <div className="lstat-label">Sales</div>
                </div>
                <div className="lstat">
                  <div className="lstat-val">€{listing.revenue}</div>
                  <div className="lstat-label">Revenue</div>
                </div>
              </div>
              <span className="status-badge" style={{ color: STATUS_COLORS[listing.status] }}>
                {listing.status}
              </span>
              <div className="listing-actions">
                <button className="action-btn">✏️ Edit</button>
                <button className="action-btn">👁 View</button>
              </div>
            </div>
          ))
        )}

        {/* Create CTA */}
        <div className="create-cta">
          <h3>Ready to list another tool?</h3>
          <p>Reach 48k+ developers. Open source tools list for free.</p>
          <button className="btn btn-green" onClick={() => setShowCreate(true)}>
            + Create new listing
          </button>
        </div>
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={() => setShowCreate(false)}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>🚀 New listing</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 24 }}>Full listing creation form coming soon. Connect your Supabase project to enable.</p>
            <button className="btn btn-outline" onClick={() => setShowCreate(false)} style={{ width: '100%' }}>Close</button>
          </div>
        </div>
      )}
    </>
  )
}
