'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ActivityItem {
  id: string
  actor_role: 'buyer' | 'seller' | 'system'
  event_type: string
  title: string
  body: string | null
  created_at: string
  metadata: Record<string, unknown>
}

const EVENT_ICONS: Record<string, string> = {
  order_placed:       '🛒',
  payment_confirmed:  '💳',
  seller_accepted:    '✅',
  delivery_started:   '🚚',
  delivery_completed: '📦',
  buyer_confirmed:    '🎉',
  dispute_raised:     '⚠️',
  dispute_resolved:   '✅',
  review_left:        '⭐',
  message_sent:       '💬',
  status_changed:     '🔄',
  location_update:    '📍',
}

const ROLE_COLORS: Record<string, string> = {
  buyer:  '#3b82f6',
  seller: '#10b981',
  system: '#64748b',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  orderId: string
  currentUserId?: string
  buyerId?: string
  sellerId?: string
}

export default function OrderActivityFeed({ orderId, currentUserId, buyerId, sellerId }: Props) {
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  useEffect(() => {
    // Initial fetch — ordered oldest first so timeline reads top-to-bottom
    supabase
      .from('order_activity')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setItems(data ?? [])
        setLoading(false)
      })

    // Real-time subscription — new events appear instantly for both parties
    const channel = supabase
      .channel(`order_activity:${orderId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'order_activity',
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          setItems(prev => [...prev, payload.new as ActivityItem])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (loading) return null
  if (items.length === 0) return null

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: '#64748b',
        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16,
      }}>
        Order Activity
      </div>

      <div style={{ position: 'relative' }}>
        {/* Vertical connector line */}
        <div style={{
          position: 'absolute', left: 14, top: 16, bottom: 8,
          width: 1, background: 'rgba(255,255,255,0.06)', zIndex: 0,
        }} />

        {items.map((item, i) => {
          const roleColor = ROLE_COLORS[item.actor_role] ?? '#64748b'
          // Show "You" when the event was performed by the current viewer
          const isCurrentUser = currentUserId && (
            (item.actor_role === 'buyer'  && currentUserId === buyerId) ||
            (item.actor_role === 'seller' && currentUserId === sellerId)
          )
          const roleLabel = item.actor_role === 'system'
            ? 'system'
            : isCurrentUser
              ? 'You'
              : item.actor_role === 'buyer' ? 'Buyer' : 'Seller'
          const badgeColor = isCurrentUser ? '#f59e0b' : roleColor
          return (
            <div
              key={item.id}
              style={{
                display: 'flex', gap: 12,
                marginBottom: i < items.length - 1 ? 18 : 0,
                position: 'relative', zIndex: 1,
              }}
            >
              {/* Icon bubble */}
              <div style={{
                width: 29, height: 29, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(15,23,42,0.95)',
                border: `1px solid ${badgeColor}35`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13,
              }}>
                {EVENT_ICONS[item.event_type] ?? '•'}
              </div>

              {/* Content */}
              <div style={{ flex: 1, paddingTop: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                    {item.title}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    color: badgeColor, letterSpacing: '0.05em',
                    background: `${badgeColor}15`, padding: '1px 6px', borderRadius: 4,
                    flexShrink: 0,
                  }}>
                    {roleLabel}
                  </span>
                </div>

                {item.body && (
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                    {item.body}
                  </div>
                )}

                <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>
                  {formatTime(item.created_at)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
