'use client'
import React, { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Campaign {
  id: string
  name: string
  subject: string
  body_html: string
  segment: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed'
  scheduled_at: string | null
  sent_at: string | null
  total_recipients: number | null
  total_sent: number
  total_failed: number
  created_at: string
}

const SEGMENT_LABELS: Record<string, string> = {
  all: 'All Members',
  inactive_7d: 'Inactive 7+ days',
  inactive_30d: 'Inactive 30+ days',
  zero_trust: 'Zero Trust Balance',
  no_purchase: 'Never Purchased',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  scheduled: { label: 'Scheduled', color: '#fbbf24', bg: 'rgba(251,191,36,0.1)' },
  sending:   { label: 'Sending…',  color: '#38bdf8', bg: 'rgba(56,189,248,0.1)'  },
  sent:      { label: 'Sent',      color: '#34d399', bg: 'rgba(52,211,153,0.1)'  },
  failed:    { label: 'Failed',    color: '#f87171', bg: 'rgba(248,113,113,0.1)' },
}

const EMPTY_FORM = {
  name: '',
  subject: '',
  body_html: '',
  segment: 'all',
  scheduled_at: '',
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CampaignsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [detailView, setDetailView] = useState<Campaign | null>(null)

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (!profile || profile.role !== 'admin') { router.push('/'); return }
      setAuthorized(true)
      setLoading(false)
    }
    init()
  }, [router])

  // ── Load campaigns ─────────────────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      if (res.ok) {
        const data = await res.json() as { campaigns: Campaign[] }
        setCampaigns(data.campaigns ?? [])
      }
    } catch { /* silent */ }
    finally { setListLoading(false) }
  }, [])

  useEffect(() => {
    if (authorized) loadCampaigns()
  }, [authorized, loadCampaigns])

  // ── Form helpers ───────────────────────────────────────────────────────────
  function openCreate() {
    setEditingCampaign(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowModal(true)
  }

  function openEdit(campaign: Campaign) {
    setEditingCampaign(campaign)
    setForm({
      name: campaign.name,
      subject: campaign.subject,
      body_html: campaign.body_html,
      segment: campaign.segment,
      scheduled_at: campaign.scheduled_at
        ? new Date(campaign.scheduled_at).toISOString().slice(0, 16)
        : '',
    })
    setError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.subject.trim() || !form.body_html.trim()) {
      setError('Name, subject, and body are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: form.name.trim(),
        subject: form.subject.trim(),
        body_html: form.body_html.trim(),
        segment: form.segment,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      }

      const url = editingCampaign ? `/api/campaigns/${editingCampaign.id}` : '/api/campaigns'
      const method = editingCampaign ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Failed to save campaign')
        return
      }

      setShowModal(false)
      loadCampaigns()
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSend(campaign: Campaign) {
    if (sending) return
    if (!confirm(`Send "${campaign.name}" to ${SEGMENT_LABELS[campaign.segment] ?? campaign.segment}?\n\nThis cannot be undone.`)) return

    setSending(campaign.id)
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/send`, { method: 'POST' })
      const data = await res.json() as { totalSent?: number; totalFailed?: number; error?: string }
      if (res.ok) {
        alert(`✅ Campaign sent!\n${data.totalSent ?? 0} delivered, ${data.totalFailed ?? 0} failed.`)
        loadCampaigns()
      } else {
        alert(`❌ Send failed: ${data.error ?? 'Unknown error'}`)
      }
    } catch {
      alert('❌ Network error during send')
    } finally {
      setSending(null)
    }
  }

  async function handleDelete(campaign: Campaign) {
    if (!confirm(`Delete campaign "${campaign.name}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/campaigns/${campaign.id}`, { method: 'DELETE' })
      loadCampaigns()
    } catch { /* silent */ }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#64748b' }}>Loading…</div>
      </div>
    )
  }

  if (!authorized) return null

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .camp-input { background:#1e293b; border:1px solid rgba(56,189,248,0.2); border-radius:8px; color:#f1f5f9; padding:0.6rem 0.9rem; font-size:0.9rem; outline:none; font-family:inherit; width:100%; box-sizing:border-box; }
        .camp-input:focus { border-color:rgba(56,189,248,0.5); }
        .camp-btn { border-radius:8px; padding:0.5rem 1.1rem; font-size:0.85rem; font-weight:600; cursor:pointer; font-family:inherit; border:1px solid transparent; transition:all 0.15s; }
        .camp-btn-primary { background:linear-gradient(135deg,#38bdf8,#0284c7); color:#0f172a; border:none; }
        .camp-btn-primary:hover { opacity:0.9; }
        .camp-btn-ghost { background:rgba(56,189,248,0.08); border:1px solid rgba(56,189,248,0.2); color:#38bdf8; }
        .camp-btn-ghost:hover { background:rgba(56,189,248,0.14); }
        .camp-btn-danger { background:rgba(248,113,113,0.08); border:1px solid rgba(248,113,113,0.25); color:#f87171; }
        .camp-btn-danger:hover { background:rgba(248,113,113,0.14); }
        .camp-btn-warn { background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.25); color:#fbbf24; }
        .camp-btn-warn:hover { background:rgba(251,191,36,0.14); }
        .camp-table { width:100%; border-collapse:collapse; }
        .camp-table th { text-align:left; font-size:0.72rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; padding:0.65rem 1rem; border-bottom:1px solid rgba(56,189,248,0.08); }
        .camp-table td { padding:0.8rem 1rem; border-bottom:1px solid rgba(56,189,248,0.05); font-size:0.85rem; color:#cbd5e1; }
        .camp-table tr:hover td { background:rgba(56,189,248,0.03); }
        .camp-label { display:block; font-size:0.78rem; color:#64748b; font-weight:600; margin-bottom:0.35rem; text-transform:uppercase; letter-spacing:0.04em; }
      `}</style>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2rem 1.5rem 1.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
              <a href="/admin" style={{ fontSize: '0.8rem', color: '#64748b', textDecoration: 'none' }}>← Admin</a>
              <span style={{ color: '#334155' }}>/</span>
              <span style={{ background: 'rgba(56,189,248,0.15)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 6, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700, color: '#38bdf8' }}>CAMPAIGNS</span>
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Outbound Campaigns</h1>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>Broadcast emails to FreeTrust member segments</p>
          </div>
          <button className="camp-btn camp-btn-primary" onClick={openCreate}>
            + New Campaign
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Total Campaigns', value: campaigns.length, color: '#38bdf8' },
            { label: 'Sent', value: campaigns.filter(c => c.status === 'sent').length, color: '#34d399' },
            { label: 'Scheduled', value: campaigns.filter(c => c.status === 'scheduled').length, color: '#fbbf24' },
            { label: 'Drafts', value: campaigns.filter(c => c.status === 'draft').length, color: '#94a3b8' },
          ].map(s => (
            <div key={s.label} style={{ background: '#1e293b', border: `1px solid ${s.color}20`, borderRadius: 12, padding: '1rem 1.5rem', flex: '1 1 140px' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Campaign list */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
          {listLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading campaigns…</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📧</div>
              <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem' }}>No campaigns yet. Create your first broadcast.</div>
              <button className="camp-btn camp-btn-primary" onClick={openCreate}>Create Campaign</button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="camp-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Segment</th>
                    <th>Status</th>
                    <th>Recipients</th>
                    <th>Sent / Failed</th>
                    <th>Scheduled / Sent At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => {
                    const statusCfg = STATUS_CONFIG[c.status] ?? STATUS_CONFIG.draft
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>{c.subject}</div>
                        </td>
                        <td>
                          <span style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {SEGMENT_LABELS[c.segment] ?? c.segment}
                          </span>
                        </td>
                        <td>
                          <span style={{ background: statusCfg.bg, borderRadius: 999, padding: '0.2rem 0.65rem', fontSize: '0.72rem', fontWeight: 700, color: statusCfg.color, whiteSpace: 'nowrap' }}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td style={{ color: '#94a3b8' }}>
                          {c.total_recipients != null ? c.total_recipients.toLocaleString() : '—'}
                        </td>
                        <td>
                          <span style={{ color: '#34d399', fontWeight: 700 }}>{c.total_sent}</span>
                          {c.total_failed > 0 && <span style={{ color: '#f87171', marginLeft: 6 }}>/ {c.total_failed}</span>}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {c.sent_at
                            ? new Date(c.sent_at).toLocaleString('en-IE')
                            : c.scheduled_at
                            ? new Date(c.scheduled_at).toLocaleString('en-IE')
                            : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'nowrap' }}>
                            <button className="camp-btn camp-btn-ghost" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }} onClick={() => setDetailView(c)}>
                              View
                            </button>
                            {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'failed') && (
                              <button className="camp-btn camp-btn-ghost" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }} onClick={() => openEdit(c)}>
                                Edit
                              </button>
                            )}
                            {(c.status === 'draft' || c.status === 'scheduled' || c.status === 'failed') && (
                              <button
                                className="camp-btn camp-btn-warn"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', opacity: sending === c.id ? 0.6 : 1 }}
                                onClick={() => handleSend(c)}
                                disabled={!!sending}
                              >
                                {sending === c.id ? 'Sending…' : 'Send Now'}
                              </button>
                            )}
                            {c.status !== 'sending' && c.status !== 'sent' && (
                              <button className="camp-btn camp-btn-danger" style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem' }} onClick={() => handleDelete(c)}>
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create / Edit Modal ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 16, padding: '2rem', maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                {editingCampaign ? 'Edit Campaign' : 'New Campaign'}
              </h2>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem' }}>✕</button>
            </div>

            {error && (
              <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.85rem', color: '#f87171' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label className="camp-label">Campaign Name</label>
                <input className="camp-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. April Re-engagement" />
              </div>

              <div>
                <label className="camp-label">Email Subject</label>
                <input className="camp-input" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="e.g. We miss you on FreeTrust 👋" />
              </div>

              <div>
                <label className="camp-label">Audience Segment</label>
                <select
                  className="camp-input"
                  value={form.segment}
                  onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                  style={{ cursor: 'pointer' }}
                >
                  {Object.entries(SEGMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value} style={{ background: '#1e293b' }}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="camp-label">Email Body (HTML)</label>
                <textarea
                  className="camp-input"
                  value={form.body_html}
                  onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))}
                  placeholder="<p>Hi there,</p><p>Here's what's new on FreeTrust...</p>"
                  rows={8}
                  style={{ resize: 'vertical', lineHeight: 1.5 }}
                />
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.35rem' }}>
                  HTML is supported. The subject line will be rendered as an h1 above this body.
                </div>
              </div>

              <div>
                <label className="camp-label">Schedule (optional)</label>
                <input
                  className="camp-input"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
                />
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.35rem' }}>
                  Leave empty to save as draft and send manually. Scheduled sends run every 15 minutes.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.75rem', justifyContent: 'flex-end' }}>
              <button className="camp-btn camp-btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="camp-btn camp-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editingCampaign ? 'Update Campaign' : 'Save Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailView && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 16, padding: '2rem', maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>{detailView.name}</h2>
              <button onClick={() => setDetailView(null)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '1.2rem', cursor: 'pointer', padding: '0.2rem' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { label: 'Status', value: STATUS_CONFIG[detailView.status]?.label ?? detailView.status, color: STATUS_CONFIG[detailView.status]?.color ?? '#94a3b8' },
                { label: 'Segment', value: SEGMENT_LABELS[detailView.segment] ?? detailView.segment, color: '#94a3b8' },
                { label: 'Recipients', value: detailView.total_recipients?.toLocaleString() ?? '—', color: '#38bdf8' },
                { label: 'Sent', value: detailView.total_sent.toLocaleString(), color: '#34d399' },
                { label: 'Failed', value: detailView.total_failed.toLocaleString(), color: detailView.total_failed > 0 ? '#f87171' : '#64748b' },
                { label: 'Created', value: new Date(detailView.created_at).toLocaleDateString('en-IE'), color: '#64748b' },
              ].map(s => (
                <div key={s.label} style={{ background: '#0f172a', borderRadius: 10, padding: '0.85rem 1rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Subject</div>
              <div style={{ color: '#f1f5f9', fontSize: '0.9rem' }}>{detailView.subject}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>Email Body</div>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '1rem', fontSize: '0.82rem', color: '#94a3b8', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', lineHeight: 1.5 }}>
                {detailView.body_html}
              </div>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="camp-btn camp-btn-ghost" onClick={() => setDetailView(null)}>Close</button>
              {(detailView.status === 'draft' || detailView.status === 'failed') && (
                <button
                  className="camp-btn camp-btn-warn"
                  onClick={() => { setDetailView(null); handleSend(detailView) }}
                  disabled={!!sending}
                >
                  Send Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
