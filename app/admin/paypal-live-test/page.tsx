'use client'

import { useEffect, useState } from 'react'

type StartResponse = {
  approval_url?: string
  run_id?: string
  amount_cents?: number
  reused?: boolean
  error?: string
}

export default function PayPalLiveTestPage() {
  const [busy, setBusy] = useState(false)
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setResult(params.get('result'))
    if (params.get('result') === 'success') setMessage('The €1 PayPal payment was captured. No seller payout was submitted.')
    if (params.get('result') === 'cancelled') setMessage('The PayPal approval was cancelled. No payment was captured.')
    if (params.get('result') === 'error') setMessage('The PayPal live test did not complete. Check the server logs and audit row before retrying.')
  }, [])

  const start = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const response = await fetch('/api/admin/paypal-live-test', { method: 'POST', headers: { 'Content-Type': 'application/json' } })
      const data = await response.json() as StartResponse
      if (!response.ok || !data.approval_url) throw new Error(data.error ?? 'Could not start the live test')
      setApprovalUrl(data.approval_url)
      setMessage(data.reused ? 'A pending one-use test already exists. Continue to PayPal to complete it.' : 'The one-use test order is ready for PayPal approval.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start the live test')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#07111f', color: '#e2e8f0', padding: '1rem', fontFamily: 'var(--font-geist-sans), system-ui, sans-serif' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', paddingTop: '2rem' }}>
        <a href="/admin" style={{ color: '#7dd3fc', fontSize: '.85rem' }}>← Admin dashboard</a>
        <section style={{ marginTop: '1rem', border: '1px solid rgba(251,191,36,.35)', borderRadius: 20, padding: '1.25rem', background: 'rgba(30,41,59,.72)' }}>
          <p style={{ color: '#fbbf24', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: '.72rem' }}>Live payment test</p>
          <h1 style={{ margin: '.35rem 0 .7rem', fontSize: 'clamp(1.5rem, 5vw, 2.2rem)' }}>PayPal €1 capture check</h1>
          <p style={{ color: '#cbd5e1', lineHeight: 1.6 }}>This creates exactly one live EUR PayPal order for €1.00, captures it after approval, and deliberately submits no seller payout. The captured funds remain in the platform PayPal account for manual reconciliation or refund.</p>
          <p style={{ color: '#fca5a5', fontWeight: 800, lineHeight: 1.5 }}>Only continue if you recognise the PayPal account and approve a real €1 charge.</p>
          <button type="button" onClick={start} disabled={busy || result === 'success'} style={{ marginTop: '.8rem', minHeight: 48, border: 0, borderRadius: 12, padding: '0 1rem', background: result === 'success' ? '#475569' : '#f59e0b', color: '#111827', fontWeight: 900, cursor: busy ? 'wait' : 'pointer' }}>{busy ? 'Preparing…' : result === 'success' ? 'Test already captured' : 'Start one-use €1 test'}</button>
          {approvalUrl ? <p style={{ marginTop: '1rem' }}><a href={approvalUrl} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 46, borderRadius: 12, padding: '0 1rem', background: '#2563eb', color: '#fff', fontWeight: 900, textDecoration: 'none' }}>Continue to PayPal approval →</a></p> : null}
          {message ? <p role="status" style={{ marginTop: '1rem', color: message.includes('captured') ? '#86efac' : '#cbd5e1', lineHeight: 1.5 }}>{message}</p> : null}
        </section>
      </div>
    </main>
  )
}
