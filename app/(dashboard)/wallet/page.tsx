'use client'

import { useState } from 'react'
import Link from 'next/link'

const transactions = [
  { id: 'tx-001', type: 'credit', description: 'Sale: AuthShield Pro License', amount: 49.00, date: '2026-04-06', status: 'completed' },
  { id: 'tx-002', type: 'debit', description: 'Purchase: SOC2 Toolkit', amount: 29.00, date: '2026-04-05', status: 'completed' },
  { id: 'tx-003', type: 'credit', description: 'Sale: VaultKey Enterprise', amount: 199.00, date: '2026-04-04', status: 'completed' },
  { id: 'tx-004', type: 'debit', description: 'Platform fee (2.5%)', amount: 6.20, date: '2026-04-04', status: 'completed' },
  { id: 'tx-005', type: 'credit', description: 'Referral bonus', amount: 10.00, date: '2026-04-03', status: 'completed' },
  { id: 'tx-006', type: 'pending', description: 'Withdrawal to bank account', amount: 150.00, date: '2026-04-07', status: 'pending' },
]

export default function WalletPage() {
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [amount, setAmount] = useState('')

  const balance = 212.80
  const pending = 150.00
  const available = balance - pending

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

        .page { max-width: 900px; margin: 0 auto; padding: 40px 24px; }
        .page-header { margin-bottom: 32px; }
        .page-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 4px; }
        .page-sub { font-size: 14px; color: #64748b; }

        /* Balance cards */
        .balance-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .balance-card { background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; padding: 24px; }
        .balance-card.primary { border-color: rgba(16,185,129,0.3); background: rgba(16,185,129,0.06); }
        .balance-label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; margin-bottom: 10px; }
        .balance-value { font-size: 32px; font-weight: 800; letter-spacing: -1px; color: #f8fafc; }
        .balance-card.primary .balance-value { color: #10b981; }
        .balance-sub { font-size: 12px; color: #475569; margin-top: 6px; }

        /* Actions */
        .actions-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 32px; }
        .btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: opacity 0.2s, transform 0.15s; text-decoration: none; }
        .btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-green { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }
        .btn-outline { background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); color: #cbd5e1; }
        .btn-outline:hover { border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.06); }

        /* Withdraw modal */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 200; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .modal { background: #0f172a; border: 1px solid rgba(16,185,129,0.2); border-radius: 20px; padding: 32px; width: 100%; max-width: 420px; }
        .modal h3 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
        .modal p { font-size: 14px; color: #64748b; margin-bottom: 24px; }
        .modal label { display: block; font-size: 13px; font-weight: 500; color: #94a3b8; margin-bottom: 6px; }
        .modal input { width: 100%; background: rgba(30,41,59,0.8); border: 1px solid rgba(100,116,139,0.3); border-radius: 10px; padding: 12px 14px; font-size: 15px; color: #f8fafc; outline: none; font-family: inherit; margin-bottom: 20px; }
        .modal input:focus { border-color: rgba(16,185,129,0.5); box-shadow: 0 0 0 3px rgba(16,185,129,0.1); }
        .modal-actions { display: flex; gap: 10px; }

        /* Transactions */
        .section-title { font-size: 16px; font-weight: 700; color: #f8fafc; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .tx-list { display: flex; flex-direction: column; gap: 2px; }
        .tx-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; transition: border-color 0.15s; }
        .tx-row:hover { border-color: rgba(255,255,255,0.1); }
        .tx-left { display: flex; align-items: center; gap: 14px; }
        .tx-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
        .tx-icon.credit { background: rgba(16,185,129,0.12); }
        .tx-icon.debit { background: rgba(239,68,68,0.1); }
        .tx-icon.pending { background: rgba(245,158,11,0.1); }
        .tx-desc { font-size: 14px; color: #e2e8f0; font-weight: 500; }
        .tx-date { font-size: 12px; color: #475569; margin-top: 2px; }
        .tx-right { text-align: right; }
        .tx-amount { font-size: 15px; font-weight: 700; }
        .tx-amount.credit { color: #10b981; }
        .tx-amount.debit { color: #f87171; }
        .tx-amount.pending { color: #fbbf24; }
        .tx-status { font-size: 11px; margin-top: 3px; padding: 2px 8px; border-radius: 20px; display: inline-block; }
        .tx-status.completed { background: rgba(16,185,129,0.1); color: #6ee7b7; }
        .tx-status.pending { background: rgba(245,158,11,0.1); color: #fbbf24; }
      `}</style>

      <nav className="nav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🛡</div>
          <span className="nav-logo-text">Free<span>Trust</span></span>
        </Link>
        <div className="nav-actions">
          <Link href="/browse" className="nav-link">Marketplace</Link>
          <Link href="/listings" className="nav-link">My Listings</Link>
          <Link href="/wallet" className="nav-link active">Wallet</Link>
          <Link href="/profile" className="nav-link">Profile</Link>
        </div>
      </nav>

      <div className="page">
        <div className="page-header">
          <h1 className="page-title">💳 Wallet</h1>
          <p className="page-sub">Manage your earnings, purchases, and withdrawals</p>
        </div>

        <div className="balance-grid">
          <div className="balance-card primary">
            <div className="balance-label">Total Balance</div>
            <div className="balance-value">€{balance.toFixed(2)}</div>
            <div className="balance-sub">Lifetime earnings</div>
          </div>
          <div className="balance-card">
            <div className="balance-label">Available</div>
            <div className="balance-value">€{available.toFixed(2)}</div>
            <div className="balance-sub">Ready to withdraw</div>
          </div>
          <div className="balance-card">
            <div className="balance-label">Pending</div>
            <div className="balance-value">€{pending.toFixed(2)}</div>
            <div className="balance-sub">Processing 1–2 days</div>
          </div>
        </div>

        <div className="actions-row">
          <button className="btn btn-green" onClick={() => setShowWithdraw(true)}>
            ↑ Withdraw funds
          </button>
          <Link href="/browse" className="btn btn-outline">
            🛒 Browse & purchase
          </Link>
          <Link href="/listings" className="btn btn-outline">
            📋 My listings
          </Link>
        </div>

        <div className="section-title">🧾 Transaction history</div>
        <div className="tx-list">
          {transactions.map((tx) => (
            <div key={tx.id} className="tx-row">
              <div className="tx-left">
                <div className={`tx-icon ${tx.type}`}>
                  {tx.type === 'credit' ? '↓' : tx.type === 'debit' ? '↑' : '⏳'}
                </div>
                <div>
                  <div className="tx-desc">{tx.description}</div>
                  <div className="tx-date">{tx.date}</div>
                </div>
              </div>
              <div className="tx-right">
                <div className={`tx-amount ${tx.type}`}>
                  {tx.type === 'credit' ? '+' : '-'}€{tx.amount.toFixed(2)}
                </div>
                <span className={`tx-status ${tx.status}`}>{tx.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showWithdraw && (
        <div className="modal-overlay" onClick={() => setShowWithdraw(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Withdraw funds</h3>
            <p>Available to withdraw: <strong style={{ color: '#10b981' }}>€{available.toFixed(2)}</strong>. Funds arrive in 1–2 business days.</p>
            <label>Amount (€)</label>
            <input
              type="number"
              placeholder={`Max €${available.toFixed(2)}`}
              value={amount}
              onChange={e => setAmount(e.target.value)}
              min="1"
              max={available}
            />
            <div className="modal-actions">
              <button className="btn btn-green" style={{ flex: 1 }} onClick={() => { setShowWithdraw(false); setAmount('') }}>
                Confirm withdrawal
              </button>
              <button className="btn btn-outline" onClick={() => setShowWithdraw(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
