import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Trust balance ────────────────────────────────────────────────────────
    const [trustBalRes, trustLedgerRes, ordersEarnedRes, ordersSpentRes] = await Promise.all([
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
      // Money earned — orders where this user is the seller
      supabase
        .from('orders')
        .select('id, total_amount, status, created_at, buyer_id')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      // Money spent — orders where this user is the buyer
      supabase
        .from('orders')
        .select('id, total_amount, status, created_at, seller_id')
        .eq('buyer_id', user.id)
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
      category: 'earned' | 'spent' | 'pending' | 'withdrawn' | 'trust'
      amount: number
      currency: 'GBP' | 'TRUST'
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
        category: o.status === 'completed' ? 'earned' : o.status === 'pending' ? 'pending' : 'pending',
        amount: o.total_amount ?? 0,
        currency: 'GBP',
        description: `Sale to ${buyerName}`,
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
        amount: -(o.total_amount ?? 0),
        currency: 'GBP',
        description: `Purchase from ${sellerName}`,
        date: o.created_at,
        status: o.status,
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
    const completedEarned = (ordersEarnedRes.data ?? [])
      .filter((o: { status: string }) => o.status === 'completed')
      .reduce((s: number, o: { total_amount: number }) => s + (o.total_amount ?? 0), 0)
    const pendingEarned = (ordersEarnedRes.data ?? [])
      .filter((o: { status: string }) => o.status === 'pending' || o.status === 'processing')
      .reduce((s: number, o: { total_amount: number }) => s + (o.total_amount ?? 0), 0)
    const totalSpent = (ordersSpentRes.data ?? [])
      .filter((o: { status: string }) => o.status === 'completed')
      .reduce((s: number, o: { total_amount: number }) => s + (o.total_amount ?? 0), 0)

    return NextResponse.json({
      money: {
        available: completedEarned - totalSpent,
        pendingPayout: pendingEarned,
        totalEarned: completedEarned,
        totalSpent,
      },
      trust: {
        balance: trustBalance,
        lifetime: trustLifetime,
        updatedAt: trustUpdated,
      },
      transactions: txList,
    })
  } catch (err) {
    console.error('[GET /api/wallet]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
