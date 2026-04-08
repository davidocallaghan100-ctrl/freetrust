'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Order {
  id: string
  item_type: string
  item_title: string
  amount_pence: number
  platform_fee_pence: number
  seller_payout_pence: number
  status: string
  buyer_id: string
  seller_id: string
  created_at: string
  updated_at: string
  stripe_session_id?: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending_escrow: { label: 'Pending', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)' },
  in_progress:    { label: 'In Progress', color: '#38bdf8', bg: 'rgba(56,189,248,0.12)' },
  delivered:      { label: 'Delivered', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
  completed:      { label: 'Completed', color: '#34d399', bg: 'rgba(52,211,153,0.12)' },
  disputed:       { label: 'Disputed', color: '#f87171', bg: 'rgba(248,113,113,0.12)' },
  refunded:       { label: 'Refunded', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' },
}

const TYPE_ICONS: Record<string, string> = { service: '🛠', product: '📦' }

function poundFormat(pence: number) {
  return `£${(pence / 100).toFixed(2)}`
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function OrderCard({ order, role }: { order: Order; role: 'buyer' | 'seller' }) {
  const status = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_escrow
  return (
    <Link href={`/orders/${order.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#1e293b',
        border: '1px solid rgba(148,163,184,0.1)',
        borderRadius: 12,
        padding: '1.25rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-start',
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: 'pointer',
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,189,248,0.3)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.borderColor = 'rgba(148,163,184,0.1)'
          ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
        }}
      >
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: 'rgba(56,189,248,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', flexShrink: 0,
        }}>
          {TYPE_ICONS[order.item_type] || '📋'}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
              {order.item_title}
            </div>
            <span style={{
              fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem',
              borderRadius: 20, color: status.color, background: status.bg,
              whiteSpace: 'nowrap',
            }}>
              {status.label}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {role === 'buyer' ? '🛒 Buying' : '🏷 Selling'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 700 }}>
              {poundFormat(order.amount_pence)}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b', textTransform: 'capitalize' }}>
              {order.item_type}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {timeAgo(order.created_at)}
            </span>
          </div>

          {role === 'seller' && (
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              You receive: <span style={{ color: '#34d399', fontWeight: 600 }}>{poundFormat(order.seller_payout_pence)}</span>
              {' '}(after 8% fee)
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'buying' | 'selling'>('buying')
  const [orders, setOrders] = useState<Order[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      fetchOrders()
    })
  }, [])

  async function fetchOrders() {
    try {
      const res = await fetch('/api/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const buyingOrders = orders.filter(o => o.buyer_id === userId)
  const sellingOrders = orders.filter(o => o.seller_id === userId)
  const displayed = tab === 'buying' ? buyingOrders : sellingOrders

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '0.6rem 1.4rem',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    border: 'none',
    transition: 'all 0.2s',
    background: active ? '#38bdf8' : 'transparent',
    color: active ? '#0f172a' : '#94a3b8',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', padding: '2rem 1rem', paddingTop: '5rem' }}>
      <style>{`
        @media (max-width: 768px) {
          .orders-header { flex-direction: column !important; gap: 1rem !important; }
          .orders-stats { flex-direction: column !important; }
        }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <div className="orders-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>My Orders</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>Track your purchases and sales</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <Link href="/services" style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', borderRadius: 8, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', fontSize: '0.875rem', fontWeight: 600, border: '1px solid rgba(56,189,248,0.2)' }}>
              Browse Services
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="orders-stats" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Orders', value: orders.length, icon: '📋' },
            { label: 'Buying', value: buyingOrders.length, icon: '🛒' },
            { label: 'Selling', value: sellingOrders.length, icon: '🏷' },
            { label: 'Completed', value: orders.filter(o => o.status === 'completed').length, icon: '✅' },
          ].map(stat => (
            <div key={stat.label} style={{ flex: 1, background: '#1e293b', borderRadius: 12, padding: '1rem', textAlign: 'center', border: '1px solid rgba(148,163,184,0.1)' }}>
              <div style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>{stat.icon}</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#38bdf8' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', background: '#1e293b', padding: '0.4rem', borderRadius: 10, width: 'fit-content' }}>
          <button style={tabStyle(tab === 'buying')} onClick={() => setTab('buying')}>
            🛒 Buying ({buyingOrders.length})
          </button>
          <button style={tabStyle(tab === 'selling')} onClick={() => setTab('selling')}>
            🏷 Selling ({sellingOrders.length})
          </button>
        </div>

        {/* Orders list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            Loading orders...
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#1e293b', borderRadius: 16, border: '1px solid rgba(148,163,184,0.1)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{tab === 'buying' ? '🛒' : '🏷'}</div>
            <h3 style={{ margin: '0 0 0.5rem', color: '#f1f5f9' }}>
              {tab === 'buying' ? 'No purchases yet' : 'No sales yet'}
            </h3>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {tab === 'buying' ? 'Browse services and products to get started.' : 'List your services or products to start selling.'}
            </p>
            <Link href={tab === 'buying' ? '/services' : '/seller/gigs/create'} style={{
              display: 'inline-block', textDecoration: 'none', padding: '0.75rem 1.5rem',
              background: '#38bdf8', color: '#0f172a', borderRadius: 8, fontWeight: 700,
            }}>
              {tab === 'buying' ? 'Browse Services' : 'Create Listing'}
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayed.map(order => (
              <OrderCard key={order.id} order={order} role={tab === 'buying' ? 'buyer' : 'seller'} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
