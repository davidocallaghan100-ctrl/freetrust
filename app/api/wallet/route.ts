export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin client for money_deposits (table lacks RLS SELECT policy)
    const admin = createAdminClient()

    // ── Trust balance ────────────────────────────────────────────────────────
    const [trustBalRes, trustLedgerRes, ordersEarnedRes, ordersSpentRes, depositsRes, sentTransfersRes, receivedTransfersRes] = await Promise.all([
      supabase
        .from('trust_balances')
        .select('balance, lifetime, updated_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('trust_ledger')
        .select('id, amount, type, description, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      // Money earned — orders where this user is the seller (not deposits)
      supabase
        .from('orders')
        .select('id, amount, status, created_at, buyer_id, title')
        .eq('seller_id', user.id)
        .neq('delivery_type', 'deposit')
        .order('created_at', { ascending: false })
        .limit(100),
      // Money spent — orders where this user is the buyer (not deposits)
      supabase
        .from('orders')
        .select('id, amount, status, created_at, seller_id, title')
        .eq('buyer_id', user.id)
        .neq('delivery_type', 'deposit')
        .order('created_at', { ascending: false })
        .limit(100),
      // Wallet top-ups from money_deposits (use admin — no RLS SELECT policy on this table)
      admin
        .from('money_deposits')
        .select('id, amount_cents, currency, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100),
      // Transfers sent by this user
      admin
        .from('wallet_transfers')
        .select('id, amount, currency, note, status, created_at, recipient_id')
        .eq('sender_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100),
      // Transfers received by this user
      admin
        .from('wallet_transfers')
        .select('id, amount, currency, note, status, created_at, sender_id')
        .eq('recipient_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    const trustBalance  = trustBalRes.data?.balance  ?? 0
    const trustLifetime = trustBalRes.data?.lifetime ?? 0
    const trustUpdated  = trustBalRes.data?.updated_at ?? null
    const trustLedger   = trustLedgerRes.data ?? []

    // Build seller IDs to enrich order descriptions
    const sellerIds = (ordersSpentRes.data ?? []).map((o: { seller_id: string }) => o.seller_id).filter(Boolean)
    const buyerIds  = (ordersEarnedRes.data ?? []).map((o: { buyer_id: string }) => o.buyer_id).filter(Boolean)
    const combined = [...sellerIds, ...buyerIds]
    const allProfileIds = combined.filter((id, idx) => combined.indexOf(id) === idx)

    let profileMap: Record<string, string> = {}
    if (allProfileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', allProfileIds)
      profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? 'Unknown']))
    }

    // ── Build unified transaction list ────────────────────────────────────────
    type Tx = {
      id: string
      category: 'earned' | 'spent' | 'pending' | 'withdrawn' | 'trust' | 'deposit' | 'transfer_sent' | 'transfer_received'
      amount: number
      currency: 'EUR' | 'TRUST'
      description: string
      date: string
      status: string
    }

    const txList: Tx[] = []

    // Earned (seller)
    for (const o of ordersEarnedRes.data ?? []) {
      const buyerName = profileMap[o.buyer_id] ?? 'a buyer'
      txList.push({
        id: `order-earn-${o.id}`,
        category: o.status === 'completed' ? 'earned' : 'pending',
        amount: o.amount ?? 0,
        currency: 'EUR',
        description: `Sale: ${o.title ?? 'Service'} to ${buyerName}`,
        date: o.created_at,
        status: o.status,
      })
    }

    // Spent (buyer)
    for (const o of ordersSpentRes.data ?? []) {
      const sellerName = profileMap[o.seller_id] ?? 'a seller'
      txList.push({
        id: `order-spend-${o.id}`,
        category: 'spent',
        amount: -(o.amount ?? 0),
        currency: 'EUR',
        description: `Purchase: ${o.title ?? 'Service'} from ${sellerName}`,
        date: o.created_at,
        status: o.status,
      })
    }

    // Wallet top-ups (money_deposits)
    for (const d of depositsRes.data ?? []) {
      txList.push({
        id: `deposit-${d.id}`,
        category: 'deposit',
        amount: d.amount_cents / 100,
        currency: 'EUR',
        description: 'Wallet Top-up',
        date: d.created_at,
        status: d.status,
      })
    }

    // Transfers sent
    // Collect profile IDs for transfer counterparties
    const transferRecipientIds = (sentTransfersRes.data ?? []).map((t: { recipient_id: string }) => t.recipient_id).filter(Boolean)
    const transferSenderIds = (receivedTransfersRes.data ?? []).map((t: { sender_id: string }) => t.sender_id).filter(Boolean)
    const allTransferIds = [...transferRecipientIds, ...transferSenderIds].filter((id, idx, arr) => arr.indexOf(id) === idx && !profileMap[id])
    if (allTransferIds.length > 0) {
      const { data: tProfiles } = await supabase.from('profiles').select('id, full_name').in('id', allTransferIds)
      for (const p of tProfiles ?? []) {
        profileMap[(p as { id: string; full_name: string | null }).id] = (p as { id: string; full_name: string | null }).full_name ?? 'Unknown'
      }
    }

    for (const t of sentTransfersRes.data ?? []) {
      const recipientName = profileMap[t.recipient_id] ?? 'a member'
      const sym = t.currency === 'EUR' ? '€' : '₮'
      const fmtAmt = t.currency === 'EUR' ? Number(t.amount).toFixed(2) : String(t.amount)
      txList.push({
        id: `transfer-sent-${t.id}`,
        category: 'transfer_sent',
        amount: -Number(t.amount),
        currency: t.currency as 'EUR' | 'TRUST',
        description: `Sent ${sym}${fmtAmt} to ${recipientName}${t.note ? ` — ${t.note}` : ''}`,
        date: t.created_at,
        status: t.status,
      })
    }

    // Transfers received
    for (const t of receivedTransfersRes.data ?? []) {
      const senderName = profileMap[t.sender_id] ?? 'a member'
      const sym = t.currency === 'EUR' ? '€' : '₮'
      const fmtAmt = t.currency === 'EUR' ? Number(t.amount).toFixed(2) : String(t.amount)
      txList.push({
        id: `transfer-recv-${t.id}`,
        category: 'transfer_received',
        amount: Number(t.amount),
        currency: t.currency as 'EUR' | 'TRUST',
        description: `Received ${sym}${fmtAmt} from ${senderName}${t.note ? ` — ${t.note}` : ''}`,
        date: t.created_at,
        status: t.status,
      })
    }

    // Trust ledger as trust transactions
    for (const entry of trustLedger) {
      txList.push({
        id: `trust-${entry.id}`,
        category: 'trust',
        amount: entry.amount,
        currency: 'TRUST',
        description: entry.description ?? entry.type,
        date: entry.created_at,
        status: 'completed',
      })
    }

    // Sort by date desc
    txList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // ── Money stats ───────────────────────────────────────────────────────────
    // Total deposited via Stripe top-ups
    const totalDeposited = (depositsRes.data ?? [])
      .reduce((s: number, d: { amount_cents: number }) => s + (d.amount_cents / 100), 0)

    const completedEarned = (ordersEarnedRes.data ?? [])
      .filter((o: { status: string }) => o.status === 'completed')
      .reduce((s: number, o: { amount: number }) => s + (o.amount ?? 0), 0)
    const pendingEarned = (ordersEarnedRes.data ?? [])
      .filter((o: { status: string }) => o.status === 'pending' || o.status === 'processing')
      .reduce((s: number, o: { amount: number }) => s + (o.amount ?? 0), 0)
    const totalSpent = (ordersSpentRes.data ?? [])
      .filter((o: { status: string }) => o.status === 'completed')
      .reduce((s: number, o: { amount: number }) => s + (o.amount ?? 0), 0)

    // EUR transfers: net effect on available balance
    const eurSent = (sentTransfersRes.data ?? [])
      .filter((t: { currency: string }) => t.currency === 'EUR')
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)
    const eurReceived = (receivedTransfersRes.data ?? [])
      .filter((t: { currency: string }) => t.currency === 'EUR')
      .reduce((s: number, t: { amount: number }) => s + Number(t.amount), 0)

    return NextResponse.json({
      money: {
        available: totalDeposited + completedEarned - totalSpent - eurSent + eurReceived,
        pendingPayout: pendingEarned,
        totalEarned: completedEarned,
        totalSpent,
        totalDeposited,
      },
      trust: {
        balance: trustBalance,
        lifetime: trustLifetime,
        updatedAt: trustUpdated,
      },
      transactions: txList,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (err) {
    console.error('[GET /api/wallet]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
