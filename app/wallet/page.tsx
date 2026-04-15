'use client'
import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useCurrency } from '@/context/CurrencyContext'

// ── Types ─────────────────────────────────────────────────────────────────────

type TxCategory = 'earned' | 'spent' | 'pending' | 'withdrawn' | 'trust' | 'deposit' | 'transfer_sent' | 'transfer_received'
type Currency   = 'EUR' | 'TRUST'

interface Tx {
  id: string
  category: TxCategory
  amount: number
  currency: Currency
  description: string
  date: string
  status: string
}

interface WalletData {
  money: {
    available: number
    pendingPayout: number
    totalEarned: number
    totalSpent: number
    totalDeposited: number
    totalWithdrawn?: number
  }
  trust: {
    balance: number
    lifetime: number
    updatedAt: string | null
  }
  transactions: Tx[]
}

// Status payload returned by GET /api/stripe/connect when the user
// has finished onboarding. Used to gate the WithdrawModal — until
// payouts_enabled is true, the modal renders an "onboarding incomplete"
// CTA instead of the amount input.
interface ConnectStatus {
  onboarded: boolean
  charges_enabled?: boolean
  payouts_enabled?: boolean
  account_id?: string
}

interface TrustAction {
  key: string
  amount: number
  label: string
  repeatable: boolean
  done: boolean
}

// ── Trust level config ────────────────────────────────────────────────────────

function getTrustLevel(score: number) {
  if (score >= 5000) return { label: 'FreeTrust Ambassador', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '👑', nextAt: null,  next: 'Max level reached' }
  if (score >= 1000) return { label: 'Community Leader',    color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '🏆', nextAt: 5000, next: '5000 to Ambassador' }
  if (score >= 500)  return { label: 'Verified Member',     color: '#34d399', bg: 'rgba(52,211,153,0.12)',  icon: '✅', nextAt: 1000, next: '1000 to Leader' }
  if (score >= 100)  return { label: 'Trusted Member',      color: '#38bdf8', bg: 'rgba(56,189,248,0.12)',  icon: '⭐', nextAt: 500,  next: '500 to Verified' }
  return              { label: 'New Member',              color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '🌱', nextAt: 100,  next: '100 to Trusted' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// fmt is used internally — currency symbol injected at render via useCurrency
function fmt(n: number, currency: Currency = 'EUR', sym = '€') {
  if (currency === 'TRUST') return `₮${Math.abs(n).toLocaleString()}`
  return `${sym}${Math.abs(n).toFixed(2)}`
}

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TX_ICONS: Record<TxCategory, string> = {
  earned: '⬇', spent: '⬆', pending: '⏳', withdrawn: '🏦', trust: '💎', deposit: '💳',
  transfer_sent: '↗', transfer_received: '↙',
}
const TX_COLORS: Record<TxCategory, string> = {
  earned: '#34d399', spent: '#f87171', pending: '#f59e0b', withdrawn: '#94a3b8', trust: '#38bdf8', deposit: '#a78bfa',
  transfer_sent: '#fb923c', transfer_received: '#34d399',
}
const TX_BG: Record<TxCategory, string> = {
  earned: 'rgba(52,211,153,0.1)', spent: 'rgba(248,113,113,0.1)', pending: 'rgba(245,158,11,0.1)',
  withdrawn: 'rgba(148,163,184,0.08)', trust: 'rgba(56,189,248,0.1)', deposit: 'rgba(167,139,250,0.1)',
  transfer_sent: 'rgba(251,146,60,0.1)', transfer_received: 'rgba(52,211,153,0.1)',
}

type FilterKey = 'All' | 'Earned' | 'Spent' | 'Pending' | 'Withdrawn' | 'Trust' | 'Deposits' | 'Transfers'
const FILTERS: FilterKey[] = ['All', 'Deposits', 'Earned', 'Spent', 'Transfers', 'Pending', 'Withdrawn', 'Trust']

// ── Mini bar chart for trust history ─────────────────────────────────────────

function TrustHistoryBar({ months }: { months: { label: string; score: number }[] }) {
  const max = Math.max(...months.map(m => m.score), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '64px' }}>
      {months.map((m, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            width: '100%',
            height: `${Math.max((m.score / max) * 52, 3)}px`,
            background: i === months.length - 1
              ? 'linear-gradient(to top, #38bdf8, #818cf8)'
              : 'rgba(56,189,248,0.3)',
            borderRadius: '4px 4px 0 0',
            transition: 'height 0.5s ease',
          }} />
          <span style={{ fontSize: '9px', color: '#475569' }}>{m.label}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = '#38bdf8', icon }: {
  label: string; value: string; sub?: string; color?: string; icon: string
}) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: '22px', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TOPUP_AMOUNTS = [1000, 2500, 5000, 10000, 25000] // cents

function AddFundsModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (msg: string) => void }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [custom,   setCustom]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const amountCents = selected ?? (custom ? Math.round(parseFloat(custom) * 100) : null)

  const handlePay = async () => {
    if (!amountCents || amountCents < 100) { setError('Minimum top-up is €1'); return }
    if (amountCents > 1000000) { setError('Maximum top-up is €10,000'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/stripe/topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amountCents }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
      }
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: '480px', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9' }}>➕ Add Funds</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Secure payment via Stripe</div>
          </div>
          <button onClick={onClose} style={{ background: '#0f172a', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#64748b', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Preset amounts */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
          {TOPUP_AMOUNTS.map(amt => (
            <button
              key={amt}
              onClick={() => { setSelected(amt); setCustom('') }}
              style={{
                padding: '12px 8px', borderRadius: '10px', border: `1.5px solid ${selected === amt ? '#38bdf8' : '#334155'}`,
                background: selected === amt ? 'rgba(56,189,248,0.12)' : '#0f172a',
                color: selected === amt ? '#38bdf8' : '#f1f5f9', fontWeight: 700, fontSize: '15px',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              €{(amt / 100).toFixed(0)}
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or enter custom amount</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '15px', fontWeight: 600 }}>€</span>
            <input
              type="number"
              min="1"
              max="10000"
              step="0.01"
              placeholder="0.00"
              value={custom}
              onChange={e => { setCustom(e.target.value); setSelected(null) }}
              style={{ width: '100%', background: '#0f172a', border: `1.5px solid ${custom ? '#38bdf8' : '#334155'}`, borderRadius: '10px', padding: '12px 12px 12px 28px', fontSize: '15px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
        </div>

        {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', borderRadius: '8px' }}>{error}</div>}

        {/* Summary */}
        {amountCents && amountCents >= 100 && (
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', padding: '10px 14px', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.12)' }}>
            Adding <span style={{ color: '#38bdf8', fontWeight: 700 }}>€{(amountCents / 100).toFixed(2)}</span> to your wallet · Secure card payment
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading || !amountCents || amountCents < 100}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: (!amountCents || amountCents < 100) ? '#1e293b' : 'linear-gradient(135deg, #38bdf8, #818cf8)',
            color: (!amountCents || amountCents < 100) ? '#475569' : '#0f172a',
            fontSize: '15px', fontWeight: 800, cursor: (!amountCents || amountCents < 100) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ Redirecting to payment…' : `Pay €${amountCents && amountCents >= 100 ? (amountCents / 100).toFixed(2) : '0.00'} securely`}
        </button>

        <div style={{ textAlign: 'center', fontSize: '11px', color: '#334155', marginTop: '12px' }}>
          🔒 Powered by Stripe · SSL encrypted · No card data stored
        </div>
      </div>
    </div>
  )
}

interface SearchUser { id: string; full_name: string | null; username: string | null; avatar_url: string | null }

function TransferModal({ walletData, onClose, onSuccess }: { walletData: WalletData | null; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchUser[]>([])
  const [searching, setSearching]   = useState(false)
  const [selected, setSelected]     = useState<SearchUser | null>(null)
  const [amount, setAmount]         = useState('')
  const [currency, setCurrency]     = useState<'EUR' | 'TRUST'>('EUR')
  const [note, setNote]             = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const availableEur   = walletData?.money.available ?? 0
  const availableTrust = walletData?.trust.balance ?? 0

  // Debounced user search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!query || query.length < 2) { setResults([]); return }
    setSearching(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`)
        if (res.ok) {
          const data = await res.json() as { users: SearchUser[] }
          setResults(data.users ?? [])
        }
      } catch { /* silent */ }
      finally { setSearching(false) }
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [query])

  const parsedAmount = parseFloat(amount) || 0
  const hasEnough = currency === 'EUR' ? parsedAmount <= availableEur : parsedAmount <= availableTrust
  const canSubmit = selected && parsedAmount > 0 && hasEnough && !loading

  const handleTransfer = async () => {
    if (!canSubmit) return
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: selected.id,
          amount: parsedAmount,
          currency,
          note: note.trim() || undefined,
        }),
      })
      const data = await res.json() as { transfer?: { id: string; amount: number; currency: string; recipient: string }; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Transfer failed')
        setLoading(false)
        return
      }
      const sym = currency === 'EUR' ? '€' : '₮'
      const fmtAmt = currency === 'EUR' ? parsedAmount.toFixed(2) : String(parsedAmount)
      onSuccess(`✅ ${sym}${fmtAmt} sent to ${data.transfer?.recipient ?? selected.full_name ?? 'recipient'}!`)
    } catch {
      setError('Network error — please try again')
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: '480px', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9' }}>↗ Transfer Funds</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Send € or ₮ to another FreeTrust member</div>
          </div>
          <button onClick={onClose} style={{ background: '#0f172a', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#64748b', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Recipient search */}
        {!selected ? (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recipient</label>
            <input
              type="text"
              placeholder="Search by name, username, or email..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1.5px solid #334155', borderRadius: '10px', padding: '12px', fontSize: '14px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
            {searching && <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>Searching...</div>}
            {results.length > 0 && (
              <div style={{ marginTop: '6px', background: '#0f172a', border: '1px solid #334155', borderRadius: '10px', maxHeight: '180px', overflowY: 'auto' }}>
                {results.map(u => (
                  <button
                    key={u.id}
                    onClick={() => { setSelected(u); setQuery(''); setResults([]) }}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'transparent', border: 'none', borderBottom: '1px solid #1e293b', cursor: 'pointer', textAlign: 'left' }}
                  >
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: '#0f172a' }}>{(u.full_name ?? '?')[0].toUpperCase()}</div>
                    }
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{u.full_name ?? 'Unknown'}</div>
                      {u.username && <div style={{ fontSize: '11px', color: '#64748b' }}>@{u.username}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && !searching && results.length === 0 && (
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>No users found</div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'rgba(56,189,248,0.06)', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.12)' }}>
            {selected.avatar_url
              ? <img src={selected.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{(selected.full_name ?? '?')[0].toUpperCase()}</div>
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>{selected.full_name ?? 'Unknown'}</div>
              {selected.username && <div style={{ fontSize: '11px', color: '#64748b' }}>@{selected.username}</div>}
            </div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>✕</button>
          </div>
        )}

        {/* Currency toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {(['EUR', 'TRUST'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              style={{
                flex: 1, padding: '10px', borderRadius: '10px',
                border: `1.5px solid ${currency === c ? (c === 'EUR' ? '#38bdf8' : '#a78bfa') : '#334155'}`,
                background: currency === c ? (c === 'EUR' ? 'rgba(56,189,248,0.12)' : 'rgba(167,139,250,0.12)') : '#0f172a',
                color: currency === c ? (c === 'EUR' ? '#38bdf8' : '#a78bfa') : '#64748b',
                fontWeight: 700, fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {c === 'EUR' ? `€ Euro · ${availableEur.toFixed(2)}` : `₮ Trust · ${availableTrust}`}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '15px', fontWeight: 600 }}>{currency === 'EUR' ? '€' : '₮'}</span>
            <input
              type="number"
              min={currency === 'EUR' ? '0.01' : '1'}
              step={currency === 'EUR' ? '0.01' : '1'}
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: `1.5px solid ${amount ? (hasEnough ? '#334155' : '#f87171') : '#334155'}`, borderRadius: '10px', padding: '12px 12px 12px 28px', fontSize: '15px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          {parsedAmount > 0 && !hasEnough && (
            <div style={{ fontSize: '12px', color: '#f87171', marginTop: '4px' }}>Insufficient balance</div>
          )}
        </div>

        {/* Note */}
        <div style={{ marginBottom: '18px' }}>
          <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Note (optional)</label>
          <input
            type="text"
            placeholder="What's this for?"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={500}
            style={{ width: '100%', background: '#0f172a', border: '1.5px solid #334155', borderRadius: '10px', padding: '12px', fontSize: '14px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
          />
        </div>

        {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', borderRadius: '8px' }}>{error}</div>}

        <button
          onClick={handleTransfer}
          disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
            background: canSubmit ? 'linear-gradient(135deg, #fb923c, #f97316)' : '#1e293b',
            color: canSubmit ? '#0f172a' : '#475569',
            fontSize: '15px', fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit', transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? '⏳ Sending…' : `Send ${currency === 'EUR' ? '€' : '₮'}${parsedAmount > 0 ? (currency === 'EUR' ? parsedAmount.toFixed(2) : parsedAmount) : '0'} to ${selected?.full_name ?? 'recipient'}`}
        </button>
      </div>
    </div>
  )
}

// ── Withdraw modal ───────────────────────────────────────────────────────────
// Replaces the old "redirect to Stripe Express dashboard" flow. The
// user enters an amount, the server validates against fresh Stripe
// account state + a server-side balance recheck, and on success a
// Stripe transfer is created and the modal shows a success state with
// an estimated arrival time.
//
// The modal handles three Connect onboarding states up-front before
// even rendering the amount input:
//
//   1. status='loading'     — querying GET /api/stripe/connect
//   2. status='not_onboarded' — Stripe says charges_enabled or
//                              payouts_enabled is false; show a CTA
//                              that redirects the user to start /
//                              finish onboarding (uses the same
//                              endpoint to mint a fresh accountLink)
//   3. status='ready'       — payouts_enabled === true; render the
//                              amount input
//
// Errors are NEVER swallowed: every failure path renders a red error
// banner inside the modal with the exact server message.
const WITHDRAW_PRESETS = [1000, 2500, 5000, 10000, 25000] // cents

function WithdrawModal({ walletData, onClose, onSuccess }: { walletData: WalletData | null; onClose: () => void; onSuccess: (msg: string) => void }) {
  const [status, setStatus]               = useState<'loading' | 'not_onboarded' | 'ready'>('loading')
  const [connectInfo, setConnectInfo]     = useState<ConnectStatus | null>(null)
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null)
  const [statusError, setStatusError]     = useState<string | null>(null)
  const [selected, setSelected]           = useState<number | null>(null)
  const [custom, setCustom]               = useState('')
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const availableEur   = Math.max(walletData?.money.available ?? 0, 0)
  const availableCents = Math.floor(availableEur * 100)
  const amountCents    = selected ?? (custom ? Math.round(parseFloat(custom) * 100) : null)

  // Probe Stripe Connect status as soon as the modal opens so we can
  // either render the amount input or redirect to onboarding without
  // making the user click "Withdraw" twice.
  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        const res = await fetch('/api/stripe/connect', { cache: 'no-store' })
        const d = await res.json() as {
          url?: string
          onboarded?: boolean
          charges_enabled?: boolean
          payouts_enabled?: boolean
          account_id?: string
          error?: string
          code?: string
        }
        if (cancelled) return
        if (!res.ok) {
          setStatusError(d.error ?? `Could not check Stripe status (HTTP ${res.status})`)
          setStatus('not_onboarded')
          return
        }
        if (d.url) {
          setOnboardingUrl(d.url)
          setStatus('not_onboarded')
          return
        }
        if (d.onboarded && d.payouts_enabled) {
          setConnectInfo({
            onboarded: true,
            charges_enabled: d.charges_enabled,
            payouts_enabled: d.payouts_enabled,
            account_id: d.account_id,
          })
          setStatus('ready')
          return
        }
        // Account exists but isn't fully enabled (e.g. payouts_enabled
        // is false because identity verification is incomplete). Tell
        // the user and offer the onboarding link.
        setConnectInfo({
          onboarded: Boolean(d.onboarded),
          charges_enabled: d.charges_enabled,
          payouts_enabled: d.payouts_enabled,
          account_id: d.account_id,
        })
        setStatus('not_onboarded')
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        setStatusError(`Network error: ${msg}`)
        setStatus('not_onboarded')
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const handleWithdraw = async () => {
    setError(null)
    if (!amountCents || amountCents < 500) {
      setError('Minimum withdrawal is €5.00')
      return
    }
    if (amountCents > availableCents) {
      setError(`You only have €${availableEur.toFixed(2)} available`)
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amountCents }),
      })
      const data = await res.json() as {
        success?: boolean
        withdrawal_id?: string
        amount_cents?: number
        arrival_estimate?: string
        error?: string
        code?: string
        detail?: string
      }
      if (!res.ok || !data.success) {
        // Surface the exact server error — never a generic message.
        // For Stripe-side errors include the underlying detail too.
        const baseMsg = data.error ?? `Withdrawal failed (HTTP ${res.status})`
        const msg = data.detail ? `${baseMsg} (${data.detail})` : baseMsg
        console.error('[wallet] withdrawal failed', { status: res.status, ...data })
        setError(msg)
        setLoading(false)
        return
      }
      const eur = ((data.amount_cents ?? amountCents) / 100).toFixed(2)
      onSuccess(`✅ €${eur} on its way to your bank — arrives in ${data.arrival_estimate ?? '1–2 business days'}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[wallet] withdrawal threw', msg)
      setError(`Network error: ${msg}`)
      setLoading(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', width: '100%', maxWidth: '480px', boxShadow: '0 -8px 40px rgba(0,0,0,0.5)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: '#f1f5f9' }}>💸 Withdraw to Bank</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>Powered by Stripe Connect</div>
          </div>
          <button onClick={onClose} style={{ background: '#0f172a', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#64748b', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Loading state */}
        {status === 'loading' && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Checking your bank account…
          </div>
        )}

        {/* Not onboarded — show CTA to finish setup */}
        {status === 'not_onboarded' && (
          <div>
            <div style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>🏦</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#fbbf24', marginBottom: '6px' }}>
                {connectInfo?.onboarded === false || !connectInfo
                  ? 'Connect your bank account'
                  : 'Finish bank verification'}
              </div>
              <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: 1.6 }}>
                {connectInfo?.onboarded
                  ? 'Stripe still needs a few details before they can pay you out.' +
                    (connectInfo.charges_enabled === false ? ' Charges aren\'t enabled yet.' : '') +
                    (connectInfo.payouts_enabled === false ? ' Payouts aren\'t enabled yet.' : '')
                  : 'You haven\'t set up Stripe yet. It takes about 5 minutes — Stripe will guide you through identity verification and bank linking.'}
              </div>
              {statusError && (
                <div style={{ fontSize: '12px', color: '#f87171', marginTop: '8px' }}>{statusError}</div>
              )}
            </div>
            <button
              onClick={() => {
                if (onboardingUrl) {
                  window.location.href = onboardingUrl
                } else {
                  // No URL was returned — try to mint a fresh one. The
                  // GET /api/stripe/connect call will create the
                  // account if one doesn't exist and return either a
                  // url or an onboarded=true response.
                  fetch('/api/stripe/connect', { cache: 'no-store' })
                    .then(r => r.json())
                    .then((d: { url?: string; error?: string }) => {
                      if (d.url) window.location.href = d.url
                      else setStatusError(d.error ?? 'Could not start Stripe onboarding')
                    })
                    .catch(err => setStatusError(err instanceof Error ? err.message : String(err)))
                }
              }}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                color: '#0f172a', fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {onboardingUrl ? 'Continue Stripe Setup →' : 'Start Stripe Setup →'}
            </button>
          </div>
        )}

        {/* Ready — show the amount input */}
        {status === 'ready' && (
          <div>
            {/* Available balance */}
            <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: '12px', padding: '14px 16px', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Available</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', lineHeight: 1.2 }}>€{availableEur.toFixed(2)}</div>
              </div>
              <div style={{ fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: '999px', padding: '4px 10px', fontWeight: 700 }}>
                ✓ Bank verified
              </div>
            </div>

            {/* Preset amounts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {WITHDRAW_PRESETS.map(amt => {
                const disabled = amt > availableCents
                return (
                  <button
                    key={amt}
                    disabled={disabled}
                    onClick={() => { setSelected(amt); setCustom(''); setError(null) }}
                    style={{
                      padding: '12px 8px', borderRadius: '10px',
                      border: `1.5px solid ${selected === amt ? '#38bdf8' : '#334155'}`,
                      background: selected === amt ? 'rgba(56,189,248,0.12)' : '#0f172a',
                      color: disabled ? '#475569' : (selected === amt ? '#38bdf8' : '#f1f5f9'),
                      fontWeight: 700, fontSize: '15px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', transition: 'all 0.15s',
                      opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    €{(amt / 100).toFixed(0)}
                  </button>
                )
              })}
            </div>

            {/* Custom amount */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Or enter custom amount</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', fontSize: '15px', fontWeight: 600 }}>€</span>
                <input
                  type="number"
                  min="5"
                  max={Math.floor(availableEur)}
                  step="0.01"
                  placeholder="0.00"
                  value={custom}
                  onChange={e => { setCustom(e.target.value); setSelected(null); setError(null) }}
                  style={{
                    width: '100%', background: '#0f172a',
                    border: `1.5px solid ${custom ? '#38bdf8' : '#334155'}`,
                    borderRadius: '10px', padding: '12px 12px 12px 28px', fontSize: '15px',
                    color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                  }}
                />
              </div>
              <button
                onClick={() => { setCustom(availableEur.toFixed(2)); setSelected(null); setError(null) }}
                disabled={availableCents <= 0}
                style={{
                  background: 'transparent', border: 'none', color: '#38bdf8',
                  fontSize: '11px', fontWeight: 600, padding: '6px 0', cursor: availableCents > 0 ? 'pointer' : 'not-allowed',
                  fontFamily: 'inherit', marginTop: '2px', opacity: availableCents > 0 ? 1 : 0.4,
                }}
              >
                Withdraw all (€{availableEur.toFixed(2)})
              </button>
            </div>

            {error && (
              <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '12px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }}>
                {error}
              </div>
            )}

            {/* Summary */}
            {amountCents !== null && amountCents >= 500 && amountCents <= availableCents && (
              <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px', padding: '10px 14px', background: 'rgba(56,189,248,0.06)', borderRadius: '8px', border: '1px solid rgba(56,189,248,0.12)' }}>
                Withdrawing <span style={{ color: '#38bdf8', fontWeight: 700 }}>€{(amountCents / 100).toFixed(2)}</span> · Arrives in 1–2 business days
              </div>
            )}

            <button
              onClick={handleWithdraw}
              disabled={loading || !amountCents || amountCents < 500 || amountCents > availableCents}
              style={{
                width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
                background: (!amountCents || amountCents < 500 || amountCents > availableCents)
                  ? '#1e293b'
                  : 'linear-gradient(135deg, #38bdf8, #0284c7)',
                color: (!amountCents || amountCents < 500 || amountCents > availableCents) ? '#475569' : '#0f172a',
                fontSize: '15px', fontWeight: 800,
                cursor: (loading || !amountCents || amountCents < 500 || amountCents > availableCents) ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading
                ? '⏳ Sending to your bank…'
                : `Withdraw €${amountCents && amountCents >= 500 ? (amountCents / 100).toFixed(2) : '0.00'}`}
            </button>

            <div style={{ textAlign: 'center', fontSize: '11px', color: '#334155', marginTop: '12px' }}>
              🔒 Secure bank transfer · Powered by Stripe
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WalletPageInner() {
  const { currency: curr } = useCurrency()
  const sym = curr.symbol
  const [data,        setData]        = useState<WalletData | null>(null)
  const [actions,     setActions]     = useState<TrustAction[]>([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState<FilterKey>('All')
  const [tab,         setTab]         = useState<'wallet' | 'trust' | 'spend'>('wallet')
  const [exporting,   setExporting]   = useState(false)
  const [spendLoading,setSpendLoading]= useState<string | null>(null)
  const [toast,       setToast]       = useState<string | null>(null)
  const [showAddFunds,  setShowAddFunds]  = useState(false)
  const [showTransfer,  setShowTransfer]  = useState(false)
  const [showWithdraw,  setShowWithdraw]  = useState(false)

  const searchParams = useSearchParams()
  // Default toast duration is 4s, but callers can pass a longer one for
  // messages the user actually needs to read (e.g. "withdrawals are still
  // being set up" explanation for the Stripe Connect gate).
  const showToast = (msg: string, durationMs = 4000) => {
    setToast(msg)
    setTimeout(() => setToast(null), durationMs)
  }

  // Handle Stripe redirect back after top-up
  // The webhook may not have fired yet, so poll a few times until the deposit
  // shows as completed and the balance reflects the new amount.
  useEffect(() => {
    const topup = searchParams.get('topup')
    const amount = searchParams.get('amount')
    if (topup === 'success' && amount) {
      showToast(`✅ €${(parseInt(amount) / 100).toFixed(2)} added to your wallet!`)
      window.history.replaceState({}, '', '/wallet')

      const expectedCents = parseInt(amount)
      let attempts = 0
      const poll = async () => {
        attempts++
        const res = await fetch('/api/wallet')
        if (!res.ok) return
        const d = await res.json() as WalletData
        setData(d)
        // Check if the deposit is reflected (totalDeposited includes it)
        const depositedCents = Math.round(d.money.totalDeposited * 100)
        if (depositedCents >= expectedCents || attempts >= 6) return
        // Webhook hasn't arrived yet — wait and retry (1s, 2s, 2s, 2s, 2s)
        await new Promise(r => setTimeout(r, attempts === 1 ? 1000 : 2000))
        await poll()
      }
      poll()
    } else if (topup === 'cancelled') {
      showToast('Payment cancelled — no charge was made')
      window.history.replaceState({}, '', '/wallet')
    }
  }, [searchParams]) // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    try {
      const [walletRes, actionsRes] = await Promise.all([
        fetch('/api/wallet'),
        fetch('/api/trust/action'),
      ])
      if (walletRes.ok) {
        const d = await walletRes.json() as WalletData
        setData(d)
      }
      if (actionsRes.ok) {
        const a = await actionsRes.json() as { actions: TrustAction[] }
        setActions(a.actions ?? [])
      }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // Build 6-month trust history approximation
  const trustHistory = (() => {
    const now = new Date()
    const balance = data?.trust.balance ?? 0
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const label = d.toLocaleDateString('en', { month: 'short' })
      // Approximate: grow linearly from 0 to current
      const score = i === 5 ? balance : Math.max(0, Math.round(balance * (i + 1) / 6))
      return { label, score }
    })
  })()

  const txList = data?.transactions ?? []

  const filtered = txList.filter(tx => {
    if (filter === 'All') return true
    if (filter === 'Transfers') return tx.category === 'transfer_sent' || tx.category === 'transfer_received'
    if (filter === 'Deposits') return tx.category === 'deposit'
    return tx.category === filter.toLowerCase()
  })

  const exportCSV = async () => {
    setExporting(true)
    try {
      const header = ['Date', 'Description', 'Category', 'Amount', 'Currency', 'Status']
      const rows = txList.map(tx => [
        fmtDate(tx.date),
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.category,
        tx.amount.toFixed(2),
        tx.currency,
        tx.status,
      ])
      const csv = [header.join(','), ...rows.map(r => r.join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `freetrust-transactions-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const spendTrust = async (action: string, cost: number, desc: string) => {
    // Client-side balance precheck — cheap UX guard so the user
    // doesn't see a server round-trip fail for a predictable reason.
    // The server re-checks atomically inside spend_trust() anyway.
    if ((data?.trust.balance ?? 0) < cost) {
      showToast(`You need ₮${cost} — you have ₮${data?.trust.balance ?? 0}`)
      return
    }
    setSpendLoading(action)
    try {
      const res = await fetch('/api/trust/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, amount: cost }),
      })
      const json = await res.json().catch(() => ({})) as {
        success?: boolean
        newBalance?: number | null
        error?: string
        code?: string
        balance?: number
        required?: number
        hint?: string | null
      }
      if (!res.ok) {
        // Surface the real server error instead of the old generic
        // "Something went wrong" — the /api/trust/spend route now
        // returns structured error payloads for insufficient funds,
        // RPC failures, and unexpected errors. Log the full object
        // to the browser console for diagnosis and show the user a
        // readable toast.
        console.error('[wallet] spend trust failed:', res.status, json)
        if (json.code === 'insufficient_funds') {
          const need = json.required ?? cost
          const have = json.balance ?? (data?.trust.balance ?? 0)
          showToast(`Need ₮${need} — you have ₮${have}`, 6000)
        } else {
          showToast(json.error ?? `Spend failed (HTTP ${res.status})`, 6000)
        }
        return
      }
      // On success, prefer the server-returned newBalance over a full
      // /api/wallet refetch (saves a round-trip). Fall back to load()
      // if the server didn't include it for some reason.
      if (typeof json.newBalance === 'number' && data) {
        setData({ ...data, trust: { ...data.trust, balance: json.newBalance } })
      } else {
        await load()
      }
      showToast(`✅ ${desc} activated!`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[wallet] spendTrust threw:', msg)
      showToast(`Network error: ${msg}`, 6000)
    }
    finally { setSpendLoading(null) }
  }

  const handleWithdraw = () => {
    console.log('[wallet] Withdraw clicked', { available: data?.money.available ?? 0 })
    if ((data?.money.available ?? 0) <= 0) {
      showToast('No available balance to withdraw')
      return
    }
    // Open the in-app WithdrawModal. The modal itself probes Stripe
    // Connect status (GET /api/stripe/connect) and either renders the
    // amount input or prompts the user to finish Stripe onboarding.
    // The actual payout happens via POST /api/stripe/payout from
    // inside the modal — we no longer redirect users out to the
    // Stripe Express dashboard to initiate payouts themselves.
    setShowWithdraw(true)
  }

  const trustLevel   = getTrustLevel(data?.trust.balance ?? 0)
  const nextAt       = trustLevel.nextAt
  const progress     = nextAt ? Math.min(((data?.trust.balance ?? 0) / nextAt) * 100, 100) : 100
  const prevLevelAt  = data?.trust.balance !== undefined ? (
    data.trust.balance >= 5000 ? 1000 :
    data.trust.balance >= 1000 ? 500 :
    data.trust.balance >= 500 ? 100 :
    data.trust.balance >= 100 ? 0 : 0
  ) : 0
  const levelProgress = nextAt
    ? Math.min(((( data?.trust.balance ?? 0) - prevLevelAt) / (nextAt - prevLevelAt)) * 100, 100)
    : 100

  const MAIN_TABS = [
    { id: 'wallet', label: '💳 Wallet',     },
    { id: 'trust',  label: '💎 Trust Score' },
    { id: 'spend',  label: '🛍 Spend Trust' },
  ] as const

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <div style={{ fontSize: '13px', color: '#64748b' }}>Loading wallet…</div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideUp { from { transform: translateY(16px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        .wallet-filter-btn:hover { background: rgba(56,189,248,0.06) !important; }
        .tx-row:hover { background: rgba(56,189,248,0.03) !important; }
        .spend-card:hover { border-color: rgba(56,189,248,0.4) !important; }
      `}</style>

      {/* Add Funds Modal */}
      {showAddFunds && (
        <AddFundsModal
          onClose={() => setShowAddFunds(false)}
          onSuccess={(msg) => { setShowAddFunds(false); showToast(msg) }}
        />
      )}

      {/* Transfer Modal */}
      {showTransfer && (
        <TransferModal
          walletData={data}
          onClose={() => setShowTransfer(false)}
          onSuccess={(msg) => { setShowTransfer(false); showToast(msg); load() }}
        />
      )}

      {/* Withdraw Modal */}
      {showWithdraw && (
        <WithdrawModal
          walletData={data}
          onClose={() => setShowWithdraw(false)}
          onSuccess={(msg) => { setShowWithdraw(false); showToast(msg, 7000); load() }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '80px', left: '50%', transform: 'translateX(-50%)', background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '12px 20px', fontSize: '13px', color: '#f1f5f9', zIndex: 9999, animation: 'slideUp 0.2s ease', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>My Wallet</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Manage earnings, trust, and spending</p>
        </div>

        {/* Main tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: '#1e293b', borderRadius: '12px', padding: '4px', border: '1px solid #334155' }}>
          {MAIN_TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '9px 4px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: tab === t.id ? 700 : 400,
                color: tab === t.id ? '#f1f5f9' : '#64748b',
                background: tab === t.id ? '#0f172a' : 'transparent',
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── WALLET TAB ──────────────────────────────────────────────────── */}
        {tab === 'wallet' && (
          <>
            {/* Hero balance card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.15) 0%, rgba(129,140,248,0.1) 100%)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '18px', padding: '24px 22px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Available Balance</div>
              <div style={{ fontSize: '44px', fontWeight: 900, lineHeight: 1, color: '#f1f5f9', marginBottom: '4px' }}>
                <span style={{ fontSize: '22px', color: '#64748b', fontWeight: 400 }}>{sym}</span>
                {Math.max(data?.money.available ?? 0, 0).toFixed(2)}
              </div>
              {(data?.money.pendingPayout ?? 0) > 0 && (
                <div style={{ fontSize: '12px', color: '#f59e0b', marginBottom: '4px' }}>
                  + {sym}{(data?.money.pendingPayout ?? 0).toFixed(2)} pending payout
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#475569', marginBottom: '18px' }}>FreeTrust earnings account</div>

              {/* Trust balance inline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px', padding: '10px 14px', background: 'rgba(56,189,248,0.08)', borderRadius: '10px', border: '1px solid rgba(56,189,248,0.15)' }}>
                <span style={{ fontSize: '20px' }}>💎</span>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Trust Balance</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#38bdf8', lineHeight: 1 }}>₮{(data?.trust.balance ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: trustLevel.bg, color: trustLevel.color }}>
                    {trustLevel.icon} {trustLevel.label}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleWithdraw}
                  style={{ flex: 1, minWidth: '100px', padding: '11px 14px', background: '#38bdf8', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 700, color: '#0f172a', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  💸 Withdraw
                </button>
                <button
                  onClick={() => setShowTransfer(true)}
                  style={{ flex: 1, minWidth: '100px', padding: '11px 14px', background: 'rgba(251,146,60,0.1)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#fb923c', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ↗ Transfer
                </button>
                <button
                  onClick={() => setShowAddFunds(true)}
                  style={{ flex: 1, minWidth: '100px', padding: '11px 14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  ➕ Add Funds
                </button>
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              <StatCard icon="💳" label="Deposited" value={`${sym}${(data?.money.totalDeposited ?? 0).toFixed(2)}`} color="#a78bfa" />
              <StatCard icon="⬇" label="Total Earned" value={`${sym}${(data?.money.totalEarned ?? 0).toFixed(2)}`} color="#34d399" />
              <StatCard icon="⬆" label="Total Spent" value={`${sym}${(data?.money.totalSpent ?? 0).toFixed(2)}`} color="#f87171" />
              <StatCard icon="💎" label="Trust Lifetime" value={`₮${(data?.trust.lifetime ?? 0).toLocaleString()}`} color="#818cf8" sub="All-time earned" />
            </div>

            {/* Transaction history */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #334155', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>Transaction History</span>
                <button
                  onClick={exportCSV}
                  disabled={exporting || txList.length === 0}
                  style={{ padding: '6px 14px', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '8px', fontSize: '12px', fontWeight: 600, color: '#38bdf8', cursor: 'pointer', fontFamily: 'inherit', opacity: (exporting || txList.length === 0) ? 0.5 : 1 }}
                >
                  {exporting ? '…' : '⬇ Export CSV'}
                </button>
              </div>

              {/* Filter pills */}
              <div style={{ display: 'flex', gap: '6px', padding: '12px 16px', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #334155' }}>
                {FILTERS.map(f => (
                  <button
                    key={f}
                    className="wallet-filter-btn"
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '5px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                      fontSize: '12px', fontWeight: filter === f ? 700 : 400,
                      color: filter === f ? '#38bdf8' : '#64748b',
                      background: filter === f ? 'rgba(56,189,248,0.12)' : 'transparent',
                      whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Rows */}
              {filtered.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                  {txList.length === 0 ? 'No transactions yet — start selling to see earnings here' : `No ${filter.toLowerCase()} transactions`}
                </div>
              ) : (
                filtered.map(tx => (
                  <div
                    key={tx.id}
                    className="tx-row"
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(51,65,85,0.5)', transition: 'background 0.1s' }}
                  >
                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0, background: TX_BG[tx.category] }}>
                      {TX_ICONS[tx.category]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description}</div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        {fmtDate(tx.date)} · {tx.category}
                        {tx.status && tx.status !== 'completed' && (
                          <span style={{ marginLeft: '6px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '10px', fontWeight: 600 }}>{tx.status}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, flexShrink: 0, color: tx.amount >= 0 ? TX_COLORS[tx.category] : '#f87171' }}>
                      {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount, tx.currency, sym)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ── TRUST SCORE TAB ──────────────────────────────────────────────── */}
        {tab === 'trust' && (
          <>
            {/* Hero trust card */}
            <div style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.15), rgba(129,140,248,0.12))', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '18px', padding: '28px 22px', marginBottom: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '56px', fontWeight: 900, color: '#38bdf8', lineHeight: 1 }}>
                ₮{(data?.trust.balance ?? 0).toLocaleString()}
              </div>
              <div style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '30px', background: trustLevel.bg, border: `1px solid ${trustLevel.color}40` }}>
                <span style={{ fontSize: '20px' }}>{trustLevel.icon}</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: trustLevel.color }}>{trustLevel.label}</span>
              </div>
              {/* Progress to next level */}
              {nextAt && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '6px' }}>
                    <span>{trustLevel.next}</span>
                    <span>{Math.round(levelProgress)}%</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(56,189,248,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${levelProgress}%`, background: `linear-gradient(90deg, ${trustLevel.color}, #38bdf8)`, borderRadius: '4px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              <StatCard icon="💎" label="Trust Balance" value={`₮${(data?.trust.balance ?? 0).toLocaleString()}`} color="#38bdf8" />
              <StatCard icon="📈" label="Lifetime Earned" value={`₮${(data?.trust.lifetime ?? 0).toLocaleString()}`} color="#818cf8" />
            </div>

            {/* Trust history chart */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>Trust Score Over Time</div>
              <TrustHistoryBar months={trustHistory} />
            </div>

            {/* Trust breakdown */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px' }}>Level Milestones</div>
              {[
                { label: 'New Member',           at: 0,    icon: '🌱', color: '#94a3b8' },
                { label: 'Trusted Member',       at: 100,  icon: '⭐', color: '#38bdf8' },
                { label: 'Verified Member',      at: 500,  icon: '✅', color: '#34d399' },
                { label: 'Community Leader',     at: 1000, icon: '🏆', color: '#a78bfa' },
                { label: 'FreeTrust Ambassador', at: 5000, icon: '👑', color: '#f59e0b' },
              ].map(lvl => {
                const reached = (data?.trust.balance ?? 0) >= lvl.at
                return (
                  <div key={lvl.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(51,65,85,0.5)' }}>
                    <span style={{ fontSize: '20px', width: '28px', textAlign: 'center' }}>{lvl.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: reached ? '#f1f5f9' : '#475569' }}>{lvl.label}</div>
                      <div style={{ fontSize: '11px', color: '#475569' }}>₮{lvl.at.toLocaleString()}+</div>
                    </div>
                    {reached ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: lvl.color, background: `${lvl.color}15`, padding: '3px 10px', borderRadius: '20px' }}>✓ Reached</span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#334155' }}>₮{(lvl.at - (data?.trust.balance ?? 0)).toLocaleString()} away</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Actions to earn more */}
            <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #334155' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9' }}>Earn More Trust</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Complete actions to grow your Trust score</div>
              </div>
              {actions.map(action => (
                <div key={action.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(51,65,85,0.4)' }}>
                  <span style={{ fontSize: '16px', flexShrink: 0 }}>{action.done ? '✅' : action.repeatable ? '🔄' : '⭕'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', color: action.done ? '#64748b' : '#cbd5e1', textDecoration: action.done ? 'line-through' : 'none' }}>{action.label}</div>
                    {action.repeatable && <div style={{ fontSize: '10px', color: '#475569', marginTop: '1px' }}>Repeatable</div>}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: action.done ? '#475569' : '#34d399' }}>+₮{action.amount}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── SPEND TRUST TAB ──────────────────────────────────────────────── */}
        {tab === 'spend' && (
          <>
            {/* Balance reminder */}
            <div style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: '14px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>💎</span>
              <div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>Your Trust Balance</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8' }}>₮{(data?.trust.balance ?? 0).toLocaleString()}</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                {
                  key: 'boost_listing',
                  icon: '🚀',
                  title: 'Boost a Listing',
                  desc: 'Feature your service or product at the top of search results for 7 days',
                  cost: 200,
                  color: '#818cf8',
                },
                {
                  key: 'offset_fees',
                  icon: '💳',
                  title: 'Offset Platform Fee',
                  desc: 'Use ₮100 Trust to reduce your next transaction fee by €1',
                  cost: 100,
                  color: '#38bdf8',
                },
                {
                  key: 'donate_impact',
                  icon: '🌍',
                  title: 'Donate to Impact Fund',
                  desc: 'Convert ₮50 Trust into a €0.50 donation to FreeTrust\'s Impact Fund',
                  cost: 50,
                  color: '#34d399',
                },
                {
                  key: 'unlock_badge',
                  icon: '🏅',
                  title: 'Unlock Profile Badge',
                  desc: 'Add a special "Early Supporter" badge to your profile',
                  cost: 150,
                  color: '#f59e0b',
                },
                {
                  key: 'featured_profile',
                  icon: '⭐',
                  title: 'Featured Profile',
                  desc: 'Appear in the "Featured Members" section for 3 days',
                  cost: 300,
                  color: '#f472b6',
                },
              ].map(item => {
                const canAfford = (data?.trust.balance ?? 0) >= item.cost
                return (
                  <div
                    key={item.key}
                    className="spend-card"
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '16px 18px', transition: 'border-color 0.15s' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', background: `${item.color}15`, flexShrink: 0 }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>{item.title}</div>
                          <div style={{ fontSize: '14px', fontWeight: 800, color: item.color }}>₮{item.cost}</div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 12px', lineHeight: 1.5 }}>{item.desc}</div>
                        <button
                          onClick={() => spendTrust(item.key, item.cost, item.title)}
                          disabled={!canAfford || spendLoading === item.key}
                          style={{
                            padding: '8px 18px', borderRadius: '8px', border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed',
                            fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                            background: canAfford ? item.color : 'rgba(100,116,139,0.2)',
                            color: canAfford ? '#0f172a' : '#475569',
                            opacity: spendLoading === item.key ? 0.7 : 1,
                            transition: 'all 0.15s',
                          }}
                        >
                          {spendLoading === item.key ? '…' : canAfford ? `Use ₮${item.cost}` : `Need ₮${item.cost - (data?.trust.balance ?? 0)} more`}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: '12px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399', marginBottom: '6px' }}>💡 Trust Economy</div>
              <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.6 }}>
                Trust (₮) is FreeTrust&apos;s internal reputation currency. Earn it by completing transactions, getting reviews, referring members, and contributing to the community. Spend it to unlock perks and reduce fees.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function WalletPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#64748b' }}>Loading wallet…</div>}>
      <WalletPageInner />
    </Suspense>
  )
}
