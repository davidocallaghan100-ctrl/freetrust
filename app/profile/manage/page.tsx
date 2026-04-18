'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type ItemType = 'service' | 'product' | 'rent_share' | 'job'
type TabKey = 'services' | 'products' | 'rentShare' | 'jobs'

interface ListingItem {
  id: string
  title: string
  price?: number | null
  price_per_day?: number | null
  currency?: string
  thumbnail_url?: string | null
  status: string
  created_at: string
  type: ItemType
  job_type?: string
  location_type?: string
  location?: string | null
  applicant_count?: number
  tags?: string[]
}

const TAB_CONFIG: { key: TabKey; label: string; icon: string; createHref: string; createLabel: string }[] = [
  { key: 'services',  label: 'Services',     icon: '🛠', createHref: '/seller/gigs/create', createLabel: 'Post your first service →' },
  { key: 'products',  label: 'Products',     icon: '📦', createHref: '/products/new',       createLabel: 'List your first product →' },
  { key: 'rentShare', label: 'Rent & Share', icon: '♻️', createHref: '/rent-share/new',     createLabel: 'Share your first item →' },
  { key: 'jobs',      label: 'Jobs',         icon: '💼', createHref: '/jobs/new',           createLabel: 'Post your first job →' },
]

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  active:   { bg: 'rgba(52,211,153,0.2)',  color: '#34d399', label: 'Active' },
  draft:    { bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24', label: 'Draft' },
  archived: { bg: 'rgba(148,163,184,0.2)', color: '#cbd5e1', label: 'Archived' },
  closed:   { bg: 'rgba(148,163,184,0.2)', color: '#cbd5e1', label: 'Closed' },
  filled:   { bg: 'rgba(56,189,248,0.2)',  color: '#38bdf8', label: 'Filled' },
  rented:   { bg: 'rgba(56,189,248,0.2)',  color: '#38bdf8', label: 'Rented' },
  inactive: { bg: 'rgba(148,163,184,0.2)', color: '#cbd5e1', label: 'Inactive' },
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const d = Math.floor(ms / 86400000)
  if (d < 1) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatPrice(item: ListingItem): string {
  const sym = item.currency === 'GBP' ? '£' : item.currency === 'USD' ? '$' : '€'
  if (item.type === 'rent_share') {
    const p = item.price_per_day
    return p ? `${sym}${p}/day` : 'Price on request'
  }
  return item.price ? `${sym}${item.price}` : 'Free'
}

function detailHref(item: ListingItem): string {
  if (item.type === 'service') return `/services/${item.id}`
  if (item.type === 'product') return `/products/${item.id}`
  if (item.type === 'job') return `/jobs/${item.id}`
  return `/rent-share/${item.id}`
}

function editHref(item: ListingItem): string {
  if (item.type === 'rent_share') return `/rent-share/${item.id}/edit`
  if (item.type === 'job') return `/jobs/${item.id}/edit`
  return `/products/${item.id}/edit`
}

function deleteEndpoint(item: ListingItem): string {
  if (item.type === 'rent_share') return `/api/rent-share/${item.id}`
  if (item.type === 'job') return `/api/jobs/${item.id}`
  return `/api/listings/${item.id}`
}

function typeLabel(item: ListingItem): string {
  if (item.type === 'service') return 'service'
  if (item.type === 'product') return 'product'
  if (item.type === 'job') return 'job'
  return 'item'
}

const JOB_TYPE_LABELS: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', freelance: 'Freelance', internship: 'Internship' }
const LOC_TYPE_LABELS: Record<string, string> = { remote: 'Remote', hybrid: 'Hybrid', on_site: 'On-site' }

export default function ManageListingsPage() {
  const router = useRouter()
  const [data, setData] = useState<Record<TabKey, ListingItem[]>>({ services: [], products: [], rentShare: [], jobs: [] })
  const [activeTab, setActiveTab] = useState<TabKey>('services')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ListingItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3000) }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/me/listings', { cache: 'no-store' })
      if (res.status === 401) { router.push('/login?redirect=/profile/manage'); return }
      if (!res.ok) { setError('Failed to load listings'); setLoading(false); return }
      const d = await res.json() as { services: ListingItem[]; products: ListingItem[]; rentShare: ListingItem[]; jobs: ListingItem[] }
      setData({ services: d.services ?? [], products: d.products ?? [], rentShare: d.rentShare ?? [], jobs: d.jobs ?? [] })
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(deleteEndpoint(deleteTarget), { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        showToast((d as { error?: string }).error ?? 'Delete failed')
        setDeleting(false)
        return
      }
      setData(prev => {
        const key: TabKey = deleteTarget.type === 'service' ? 'services' : deleteTarget.type === 'product' ? 'products' : deleteTarget.type === 'job' ? 'jobs' : 'rentShare'
        return { ...prev, [key]: prev[key].filter(i => i.id !== deleteTarget.id) }
      })
      showToast('Deleted')
      setDeleteTarget(null)
    } catch {
      showToast('Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const items = data[activeTab]
  const tabConfig = TAB_CONFIG.find(t => t.key === activeTab)!

  return (
    <div style={{ minHeight: '100vh', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        .ml-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .ml-tabs { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; }
        .ml-tabs::-webkit-scrollbar { display: none; }
        .ml-tab { flex-shrink: 0; padding: 8px 16px; border-radius: 999px; border: 1px solid rgba(148,163,184,0.15); background: transparent; color: #64748b; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.15s; }
        .ml-tab:hover { border-color: rgba(56,189,248,0.3); color: #94a3b8; }
        .ml-tab-active { background: rgba(56,189,248,0.15); border-color: #38bdf8; color: #38bdf8; }
        @media (min-width: 640px) { .ml-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 10, padding: '10px 18px', fontSize: 13, color: '#f1f5f9', zIndex: 9999, boxShadow: '0 8px 30px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}

      {/* Delete modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 9999 }} onClick={() => !deleting && setDeleteTarget(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16, padding: 28, maxWidth: 400, width: '100%' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Delete this {typeLabel(deleteTarget)}?</div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 6 }}>&ldquo;{deleteTarget.title}&rdquo;</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>This cannot be undone.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={confirmDelete} disabled={deleting} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.35)', background: 'rgba(248,113,113,0.15)', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 780, margin: '0 auto', padding: '0 1rem' }}>
        {/* Header */}
        <div style={{ padding: '1.5rem 0 1rem' }}>
          <Link href="/profile" style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600 }}>← Back to profile</Link>
          <h1 style={{ fontSize: 'clamp(1.3rem,3vw,1.7rem)', fontWeight: 800, margin: '0.75rem 0 0.25rem', letterSpacing: '-0.3px' }}>My Listings</h1>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem' }}>Edit, delete, or manage everything you&apos;ve posted</p>
        </div>

        {/* Tabs */}
        <div className="ml-tabs" style={{ marginBottom: '1.25rem' }}>
          {TAB_CONFIG.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`ml-tab ${activeTab === tab.key ? 'ml-tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label} ({data[tab.key].length})
            </button>
          ))}
        </div>

        {/* Loading */}
        {loading && <div style={{ textAlign: 'center', padding: '4rem 1rem', color: '#64748b', fontSize: '0.9rem' }}>Loading...</div>}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 14, padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#f87171', marginBottom: 12 }}>{error}</div>
            <button type="button" onClick={load} style={{ background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.35)', color: '#fca5a5', borderRadius: 8, padding: '0.5rem 1.25rem', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, padding: '3rem 1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{tabConfig.icon}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>
              {activeTab === 'services' && "You haven't posted any services yet."}
              {activeTab === 'products' && "No products yet."}
              {activeTab === 'rentShare' && "No items to rent yet."}
              {activeTab === 'jobs' && "No jobs posted yet."}
            </div>
            <Link href={tabConfig.createHref} style={{ color: '#38bdf8', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600 }}>
              {tabConfig.createLabel}
            </Link>
          </div>
        )}

        {/* Cards */}
        {!loading && !error && items.length > 0 && (
          <div className="ml-grid">
            {items.map(item => {
              const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.active
              return (
                <div key={item.id} style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {/* Thumbnail */}
                  {item.thumbnail_url ? (
                    <div style={{ height: 140, background: '#0f172a', overflow: 'hidden' }}>
                      <img src={item.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </div>
                  ) : (
                    <div style={{ height: 100, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                      {item.type === 'service' ? '🛠' : item.type === 'product' ? '📦' : '♻️'}
                    </div>
                  )}

                  <div style={{ padding: '0.85rem 1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Link href={detailHref(item)} style={{ color: '#f1f5f9', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3 }}>
                      {item.title}
                    </Link>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {item.type !== 'job' && <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8' }}>{formatPrice(item)}</span>}
                      {item.type === 'job' && item.job_type && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{JOB_TYPE_LABELS[item.job_type] ?? item.job_type} · {LOC_TYPE_LABELS[item.location_type ?? ''] ?? item.location_type}</span>}
                      {item.type === 'job' && <span style={{ fontSize: '0.72rem', color: '#64748b' }}>👥 {item.applicant_count ?? 0}</span>}
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: st.color, background: st.bg, padding: '2px 8px', borderRadius: 999 }}>{st.label}</span>
                      <span style={{ fontSize: '0.72rem', color: '#64748b', marginLeft: 'auto' }}>{relativeTime(item.created_at)}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
                      <Link href={editHref(item)} style={{ flex: 1, textAlign: 'center', padding: '0.45rem 0', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, color: '#38bdf8', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 600 }}>
                        ✏️ Edit
                      </Link>
                      <button type="button" onClick={() => setDeleteTarget(item)} style={{ flex: 1, padding: '0.45rem 0', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, color: '#f87171', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
