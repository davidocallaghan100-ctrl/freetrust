'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
const REASONS = [
  'Item not received',
  'Item not as described',
  'Service not delivered',
  'Poor quality of work',
  'Seller unresponsive',
  'Wrong item sent',
  'Damaged in transit',
  'Partial delivery only',
  'Other',
]

interface ResolutionStep {
  actor_id:      string
  actor_role:    'buyer' | 'seller' | 'system'
  message:       string
  evidence_urls: string[]
  timestamp:     string
}

interface Dispute {
  id:                      string
  order_id:                string
  raised_by:               string
  against_user:            string
  reason:                  string
  details:                 string | null
  status:                  string
  evidence_urls:           string[]
  resolution_steps:        ResolutionStep[]
  resolved_in_favour_of:   'buyer' | 'seller' | 'split' | null
  admin_notes:             string | null
  due_by:                  string | null
  closed_at:               string | null
  escalated_at:            string | null
  created_at:              string
}

interface Order {
  id:                  string
  title:               string
  amount:              number
  currency:            string
  status:              string
  dispute_window_ends: string | null
  buyer_id:            string
  seller_id:           string
  created_at:          string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })
    + ' · '
    + d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })
}

function hoursUntil(iso: string) {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000))
}

// ── Status pill ───────────────────────────────────────────────────────────────
function StatusPill({ dispute }: { dispute: Dispute }) {
  if (dispute.status === 'resolved' || dispute.closed_at) {
    const outcome =
      dispute.resolved_in_favour_of === 'buyer'  ? '🛒 Resolved — buyer wins' :
      dispute.resolved_in_favour_of === 'seller' ? '🏪 Resolved — seller wins' :
      dispute.resolved_in_favour_of === 'split'  ? '⚖️ Resolved — split' :
                                                    '✅ Resolved'
    return (
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:20, padding:'5px 14px', fontSize:13, fontWeight:700, color:'#34d399' }}>
        {outcome}
      </div>
    )
  }
  if (dispute.escalated_at) {
    return (
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:20, padding:'5px 14px', fontSize:13, fontWeight:700, color:'#fca5a5' }}>
        🚨 Escalated to FreeTrust team
      </div>
    )
  }
  if (dispute.status === 'under_review') {
    return (
      <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:20, padding:'5px 14px', fontSize:13, fontWeight:700, color:'#fbbf24' }}>
        🟡 Under review
      </div>
    )
  }
  // open
  const hrs = dispute.due_by ? hoursUntil(dispute.due_by) : null
  const overdue = hrs !== null && hrs === 0
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, background: overdue ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)', border:`1px solid ${overdue ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius:20, padding:'5px 14px', fontSize:13, fontWeight:700, color: overdue ? '#fca5a5' : '#fbbf24' }}>
      {overdue ? '⚠️ Response overdue' : `🔴 Open · ${hrs}h remaining`}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DisputePage() {
  const params  = useParams()
  const orderId = params?.id as string
  const router  = useRouter()

  const [order,       setOrder]       = useState<Order | null>(null)
  const [dispute,     setDispute]     = useState<Dispute | null>(null)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [view,        setView]        = useState<'raise' | 'thread'>('raise')

  // raise-dispute form
  const [reason,      setReason]      = useState('')
  const [details,     setDetails]     = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  // response form
  const [replyMsg,    setReplyMsg]    = useState('')
  const [replying,    setReplying]    = useState(false)
  const [replyError,  setReplyError]  = useState('')

  // resolve form (shown to both parties for mutual resolution)
  const [showResolve, setShowResolve] = useState(false)
  const [resolveFor,  setResolveFor]  = useState<'buyer' | 'seller' | 'split'>('buyer')
  const [resolving,   setResolving]   = useState(false)
  const [resolveErr,  setResolveErr]  = useState('')

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id ?? null)

    const [{ data: ord }, { data: disputes }] = await Promise.all([
      supabase.from('orders').select('id,title,amount,currency,status,dispute_window_ends,buyer_id,seller_id,created_at').eq('id', orderId).single(),
      supabase.from('disputes').select('*').eq('order_id', orderId).order('created_at', { ascending: false }).limit(1),
    ])

    setOrder(ord ?? null)
    const existingDispute = disputes?.[0] ?? null
    setDispute(existingDispute)
    setView(existingDispute ? 'thread' : 'raise')
    setLoading(false)
  }, [orderId])

  useEffect(() => { if (orderId) load() }, [orderId, load])

  const daysLeft = order?.dispute_window_ends
    ? Math.max(0, Math.ceil((new Date(order.dispute_window_ends).getTime() - Date.now()) / 86_400_000))
    : null

  // ── Raise dispute ────────────────────────────────────────────────────────
  const submitDispute = async () => {
    if (!reason) return setError('Please select a reason')
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, reason, details }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to raise dispute')
      setSuccess(true)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setSubmitting(false) }
  }

  // ── Add response ──────────────────────────────────────────────────────────
  const submitReply = async () => {
    if (!replyMsg.trim() || !dispute) return
    setReplying(true); setReplyError('')
    try {
      const res = await fetch(`/api/disputes/${dispute.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMsg.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to submit')
      setReplyMsg('')
      setDispute(json.dispute)
    } catch (e: unknown) {
      setReplyError(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setReplying(false) }
  }

  // ── Resolve dispute ───────────────────────────────────────────────────────
  const submitResolve = async () => {
    if (!dispute) return
    setResolving(true); setResolveErr('')
    try {
      const res = await fetch(`/api/disputes/${dispute.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ in_favour_of: resolveFor }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to resolve')
      setDispute(json.dispute)
      setShowResolve(false)
    } catch (e: unknown) {
      setResolveErr(e instanceof Error ? e.message : 'Something went wrong')
    } finally { setResolving(false) }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight:'calc(100vh - 104px)', paddingTop:64, background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b' }}>
      Loading…
    </div>
  )

  const isBuyer  = order?.buyer_id  === currentUser
  const isSeller = order?.seller_id === currentUser
  const isClosed = !!(dispute?.status === 'resolved' || dispute?.closed_at)

  // ── Success screen ────────────────────────────────────────────────────────
  if (success && !dispute) return (
    <div style={{ minHeight:'calc(100vh - 104px)', paddingTop:64, background:'#0f172a', color:'#f1f5f9', fontFamily:'system-ui' }}>
      <div style={{ maxWidth:600, margin:'0 auto', padding:'2rem 1rem', textAlign:'center' }}>
        <div style={{ background:'rgba(52,211,153,0.08)', border:'1px solid rgba(52,211,153,0.2)', borderRadius:16, padding:'2rem' }}>
          <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
          <h2 style={{ fontWeight:800, color:'#34d399', marginBottom:'0.5rem' }}>Dispute Raised</h2>
          <p style={{ color:'#94a3b8', fontSize:'0.9rem', marginBottom:'1.5rem' }}>
            Your dispute has been submitted. The seller has 72 hours to respond before it escalates to the FreeTrust team.
          </p>
          <button onClick={() => router.push(`/orders/${orderId}`)} style={{ background:'linear-gradient(135deg,#38bdf8,#0284c7)', border:'none', borderRadius:10, padding:'0.75rem 1.75rem', fontWeight:700, color:'#0f172a', cursor:'pointer', fontSize:'0.9rem' }}>
            View Order
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'calc(100vh - 104px)', paddingTop:64, background:'#0f172a', color:'#f1f5f9', fontFamily:'system-ui' }}>
      <div style={{ maxWidth:620, margin:'0 auto', padding:'2rem 1rem' }}>

        {/* Header */}
        <div style={{ marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8, flexWrap:'wrap' }}>
            <h1 style={{ fontSize:'1.4rem', fontWeight:800, margin:0 }}>
              {view === 'raise' ? 'Raise a Dispute' : 'Dispute Resolution'}
            </h1>
            {dispute && <StatusPill dispute={dispute} />}
          </div>
          <p style={{ color:'#64748b', fontSize:'0.85rem', margin:0 }}>
            {view === 'raise'
              ? 'Our team will review your case within 48 hours'
              : 'Track the resolution thread below. Both parties can respond.'}
          </p>
        </div>

        {/* Order info card */}
        {order && (
          <div style={{ background:'#1e293b', border:'1px solid rgba(56,189,248,0.1)', borderRadius:12, padding:'1rem 1.25rem', marginBottom:'1.25rem' }}>
            <div style={{ fontSize:'0.75rem', color:'#64748b', marginBottom:'0.25rem' }}>ORDER</div>
            <div style={{ fontSize:'0.95rem', fontWeight:700, color:'#f1f5f9', marginBottom:'0.25rem' }}>{order.title ?? `Order #${order.id.slice(0, 8)}`}</div>
            <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', fontSize:'0.82rem', color:'#64748b' }}>
              <span>€{(order.amount / 100).toFixed(2)}</span>
              <span style={{ textTransform:'capitalize' }}>Status: {order.status}</span>
              {daysLeft !== null && daysLeft > 0 && (
                <span style={{ color: daysLeft > 3 ? '#34d399' : '#fbbf24' }}>
                  ⏱ {daysLeft} day{daysLeft !== 1 ? 's' : ''} left to dispute
                </span>
              )}
              {isBuyer  && <span style={{ color:'#60a5fa', fontWeight:600 }}>🛒 You're the buyer</span>}
              {isSeller && <span style={{ color:'#34d399', fontWeight:600 }}>🏪 You're the seller</span>}
            </div>
          </div>
        )}

        {/* ── RAISE DISPUTE FORM ─────────────────────────────────────────── */}
        {view === 'raise' && (
          <>
            <div style={{ background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.15)', borderRadius:10, padding:'0.85rem 1rem', marginBottom:'1.5rem', fontSize:'0.82rem', color:'#92400e' }}>
              <strong style={{ color:'#fbbf24' }}>Dispute windows:</strong> Services: 72 hours · Physical goods: 7 days after delivery
            </div>

            <div style={{ background:'#1e293b', border:'1px solid rgba(56,189,248,0.1)', borderRadius:16, padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>
              {/* Reason chips */}
              <div>
                <label style={{ fontSize:'0.78rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'0.5rem' }}>Reason *</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'0.4rem' }}>
                  {REASONS.map(r => (
                    <button key={r} onClick={() => setReason(r)} style={{ padding:'0.45rem 0.85rem', borderRadius:999, fontSize:'0.8rem', cursor:'pointer', border: reason === r ? '1px solid rgba(56,189,248,0.4)' : '1px solid rgba(148,163,184,0.2)', background: reason === r ? 'rgba(56,189,248,0.1)' : 'transparent', color: reason === r ? '#38bdf8' : '#94a3b8', fontWeight: reason === r ? 600 : 400, transition:'all 0.12s' }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <label style={{ fontSize:'0.78rem', fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'0.35rem' }}>Details</label>
                <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Describe the issue — what happened, when, and what resolution you expect…" rows={5} maxLength={2000} style={{ width:'100%', background:'#0f172a', border:'1px solid rgba(56,189,248,0.15)', borderRadius:10, padding:'0.75rem 1rem', fontSize:'0.88rem', color:'#f1f5f9', outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
                <div style={{ fontSize:'0.72rem', color:'#475569', textAlign:'right' }}>{details.length}/2000</div>
              </div>

              {/* Evidence note */}
              <div style={{ background:'rgba(56,189,248,0.05)', border:'1px solid rgba(56,189,248,0.1)', borderRadius:8, padding:'0.65rem 0.9rem', fontSize:'0.8rem', color:'#64748b' }}>
                💡 After raising, you can add evidence screenshots or links in the response thread
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'0.65rem 1rem', fontSize:'0.85rem', color:'#fca5a5' }}>{error}</div>
              )}

              <button onClick={submitDispute} disabled={submitting || !reason} style={{ background: submitting || !reason ? 'rgba(56,189,248,0.3)' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border:'none', borderRadius:10, padding:'0.85rem', fontWeight:700, fontSize:'0.92rem', color:'#0f172a', cursor: submitting || !reason ? 'not-allowed' : 'pointer' }}>
                {submitting ? 'Submitting…' : '🚨 Submit Dispute'}
              </button>
            </div>
          </>
        )}

        {/* ── DISPUTE THREAD ─────────────────────────────────────────────── */}
        {view === 'thread' && dispute && (
          <>
            {/* 72h countdown banner */}
            {!isClosed && dispute.due_by && (
              <div style={{ background: hoursUntil(dispute.due_by) === 0 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)', border:`1px solid ${hoursUntil(dispute.due_by) === 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`, borderRadius:10, padding:'10px 14px', marginBottom:16, fontSize:13, color: hoursUntil(dispute.due_by) === 0 ? '#fca5a5' : '#fbbf24' }}>
                {hoursUntil(dispute.due_by) === 0
                  ? '⚠️ Response deadline passed — escalating to FreeTrust team'
                  : `⏰ Seller has ${hoursUntil(dispute.due_by)}h to respond · Due ${formatTime(dispute.due_by)}`}
              </div>
            )}

            {/* Original dispute */}
            <div style={{ background:'#1e293b', border:'1px solid rgba(56,189,248,0.1)', borderRadius:12, padding:'1rem 1.25rem', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:16 }}>🚨</span>
                <span style={{ fontWeight:700, color:'#f1f5f9', fontSize:14 }}>Dispute raised</span>
                <span style={{ fontSize:11, color:'#64748b', marginLeft:'auto' }}>{formatTime(dispute.created_at)}</span>
              </div>
              <div style={{ fontSize:13, color:'#fbbf24', fontWeight:600, marginBottom:4 }}>Reason: {dispute.reason}</div>
              {dispute.details && <p style={{ fontSize:13, color:'#94a3b8', margin:0, lineHeight:1.5 }}>{dispute.details}</p>}
              {dispute.evidence_urls?.length > 0 && (
                <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                  {dispute.evidence_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#38bdf8', textDecoration:'none', background:'rgba(56,189,248,0.08)', padding:'2px 8px', borderRadius:6 }}>
                      📎 Evidence {i + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Resolution thread */}
            {dispute.resolution_steps?.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#64748b', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:10 }}>Response thread</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {dispute.resolution_steps.map((step, i) => {
                    const isMe = step.actor_id === currentUser
                    const roleColor = step.actor_role === 'buyer' ? '#60a5fa' : step.actor_role === 'seller' ? '#34d399' : '#64748b'
                    return (
                      <div key={i} style={{ background: isMe ? 'rgba(16,185,129,0.06)' : '#1e293b', border:`1px solid ${isMe ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)'}`, borderRadius:10, padding:'0.85rem 1rem' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                          <span style={{ fontSize:13 }}>{step.actor_role === 'buyer' ? '🛒' : '🏪'}</span>
                          <span style={{ fontSize:12, fontWeight:700, color:roleColor }}>
                            {isMe ? 'You' : step.actor_role === 'buyer' ? 'Buyer' : 'Seller'}
                          </span>
                          <span style={{ fontSize:11, color:'#475569', marginLeft:'auto' }}>{formatTime(step.timestamp)}</span>
                        </div>
                        <p style={{ fontSize:13, color:'#cbd5e1', margin:0, lineHeight:1.55 }}>{step.message}</p>
                        {step.evidence_urls?.length > 0 && (
                          <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:4 }}>
                            {step.evidence_urls.map((url, j) => (
                              <a key={j} href={url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'#38bdf8', background:'rgba(56,189,248,0.08)', padding:'2px 8px', borderRadius:6, textDecoration:'none' }}>
                                📎 {j + 1}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Resolved outcome */}
            {isClosed && dispute.resolved_in_favour_of && (
              <div style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:12, padding:'1rem 1.25rem', marginBottom:16 }}>
                <div style={{ fontSize:14, fontWeight:700, color:'#34d399', marginBottom:4 }}>
                  {dispute.resolved_in_favour_of === 'buyer'  ? '🛒 Resolved in favour of buyer — refund processed' :
                   dispute.resolved_in_favour_of === 'seller' ? '🏪 Resolved in favour of seller — payment released' :
                   '⚖️ Resolved with split outcome'}
                </div>
                {dispute.admin_notes && <p style={{ fontSize:13, color:'#94a3b8', margin:0 }}>{dispute.admin_notes}</p>}
                {dispute.closed_at && <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>Closed {formatTime(dispute.closed_at)}</div>}
              </div>
            )}

            {/* Add response form */}
            {!isClosed && (isBuyer || isSeller) && (
              <div style={{ background:'#1e293b', border:'1px solid rgba(56,189,248,0.1)', borderRadius:12, padding:'1rem 1.25rem', marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
                  {isBuyer ? '🛒 Add your response' : '🏪 Add your response'}
                </div>
                <textarea
                  value={replyMsg}
                  onChange={e => setReplyMsg(e.target.value)}
                  placeholder="Describe your position, add evidence URLs, or propose a resolution…"
                  rows={4}
                  maxLength={2000}
                  style={{ width:'100%', background:'#0f172a', border:'1px solid rgba(56,189,248,0.15)', borderRadius:8, padding:'0.7rem 0.9rem', fontSize:'0.87rem', color:'#f1f5f9', outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', marginBottom:8 }}
                />
                {replyError && <div style={{ fontSize:12, color:'#fca5a5', marginBottom:8 }}>{replyError}</div>}
                <button onClick={submitReply} disabled={replying || !replyMsg.trim()} style={{ background: replying || !replyMsg.trim() ? 'rgba(56,189,248,0.3)' : 'rgba(56,189,248,0.15)', border:'1px solid rgba(56,189,248,0.3)', borderRadius:8, padding:'0.6rem 1.25rem', fontWeight:700, fontSize:'0.85rem', color: replying || !replyMsg.trim() ? '#64748b' : '#38bdf8', cursor: replying || !replyMsg.trim() ? 'not-allowed' : 'pointer' }}>
                  {replying ? 'Sending…' : 'Send Response'}
                </button>
              </div>
            )}

            {/* Mutual resolution — both parties can propose to close */}
            {!isClosed && (isBuyer || isSeller) && (
              <div>
                {!showResolve ? (
                  <button onClick={() => setShowResolve(true)} style={{ width:'100%', background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:10, padding:'0.75rem', fontWeight:600, fontSize:'0.85rem', color:'#34d399', cursor:'pointer' }}>
                    ✅ Propose a resolution
                  </button>
                ) : (
                  <div style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.15)', borderRadius:12, padding:'1rem 1.25rem' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#34d399', marginBottom:12 }}>⚖️ Propose resolution outcome</div>
                    <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
                      {(['buyer', 'seller', 'split'] as const).map(opt => (
                        <button key={opt} onClick={() => setResolveFor(opt)} style={{ padding:'0.5rem 1rem', borderRadius:20, fontSize:13, fontWeight:600, cursor:'pointer', border: resolveFor === opt ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.08)', background: resolveFor === opt ? 'rgba(16,185,129,0.15)' : 'transparent', color: resolveFor === opt ? '#34d399' : '#64748b' }}>
                          {opt === 'buyer' ? '🛒 Buyer wins' : opt === 'seller' ? '🏪 Seller wins' : '⚖️ Split'}
                        </button>
                      ))}
                    </div>
                    {resolveErr && <div style={{ fontSize:12, color:'#fca5a5', marginBottom:8 }}>{resolveErr}</div>}
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={submitResolve} disabled={resolving} style={{ background:'linear-gradient(135deg,#10b981,#059669)', border:'none', borderRadius:8, padding:'0.65rem 1.25rem', fontWeight:700, fontSize:'0.85rem', color:'#fff', cursor: resolving ? 'not-allowed' : 'pointer' }}>
                        {resolving ? 'Resolving…' : 'Confirm Resolution'}
                      </button>
                      <button onClick={() => setShowResolve(false)} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'0.65rem 1rem', fontWeight:600, fontSize:'0.85rem', color:'#64748b', cursor:'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Back to order */}
            <div style={{ marginTop:20, textAlign:'center' }}>
              <button onClick={() => router.push(`/orders/${orderId}`)} style={{ background:'transparent', border:'none', color:'#64748b', fontSize:13, cursor:'pointer', textDecoration:'underline' }}>
                ← Back to order
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
