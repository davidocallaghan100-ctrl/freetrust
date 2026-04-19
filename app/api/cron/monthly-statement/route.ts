// GET /api/cron/monthly-statement
//
// Runs at 07:00 UTC on the 1st of every month (see vercel.json).
// Finds every seller who had at least one completed/delivered order in the
// prior calendar month and sends them a HTML earnings summary email.
//
// Auth: same pattern as delivery-nudge — checks Authorization: Bearer <CRON_SECRET>
// (Vercel Cron injects this automatically when CRON_SECRET is set on the project).
//
// Non-blocking: each seller email is wrapped in try/catch; one failure doesn't
// abort the rest of the run.

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendMonthlyStatementEmail,
  type MonthlyStatementOrder,
} from '@/lib/resend'

const FEE_RATE_SERVICE = 0.08
const FEE_RATE_PRODUCT = 0.05

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Date range: prior calendar month ────────────────────────────────────────
  const now = new Date()
  // First day of current month → end of prior month range
  const firstOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  // First day of prior month
  const firstOfPriorMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))

  const rangeStart = firstOfPriorMonth.toISOString()
  const rangeEnd   = firstOfThisMonth.toISOString()

  const priorMonthIndex = firstOfPriorMonth.getUTCMonth() // 0-indexed
  const priorMonthName  = MONTH_NAMES[priorMonthIndex]
  const priorMonthYear  = firstOfPriorMonth.getUTCFullYear()

  console.log(`[monthly-statement] processing ${priorMonthName} ${priorMonthYear} (${rangeStart} → ${rangeEnd})`)

  const admin = createAdminClient()

  // ── Fetch all completed/delivered orders from prior month ───────────────────
  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .select('id, seller_id, buyer_id, item_title, item_type, amount_pence, created_at, invoice_number')
    .in('status', ['completed', 'delivered'])
    .gte('updated_at', rangeStart)
    .lt('updated_at', rangeEnd)

  if (ordersError) {
    console.error('[monthly-statement] orders query error:', ordersError)
    return NextResponse.json({ error: ordersError.message }, { status: 500 })
  }

  if (!orders || orders.length === 0) {
    console.log('[monthly-statement] no orders in period — nothing to send')
    return NextResponse.json({ sent: 0, skipped: 0, message: 'no orders in period' })
  }

  // ── Group orders by seller ───────────────────────────────────────────────────
  const sellerOrderMap: Record<string, typeof orders> = {}
  for (const o of orders) {
    const sid = o.seller_id as string
    if (!sellerOrderMap[sid]) sellerOrderMap[sid] = []
    sellerOrderMap[sid].push(o)
  }

  const sellerIds = Object.keys(sellerOrderMap)

  // ── Fetch seller profiles (email + name) ─────────────────────────────────────
  const { data: profiles, error: profilesError } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', sellerIds)

  if (profilesError) {
    console.error('[monthly-statement] profiles query error:', profilesError)
    return NextResponse.json({ error: profilesError.message }, { status: 500 })
  }

  const profileMap: Record<string, { email: string; full_name: string }> = {}
  for (const p of profiles ?? []) {
    if (p.email) {
      profileMap[p.id as string] = {
        email: p.email as string,
        full_name: (p.full_name as string) || 'there',
      }
    }
  }

  // ── Fetch TrustCoin activity for sellers in prior month ──────────────────────
  // trust_balances only stores current balance; we look at trust_transactions if
  // available, otherwise we estimate from delivery rewards (best-effort).
  // We use a lightweight query — if the table doesn't exist we skip gracefully.
  const trustMap: Record<string, number> = {}
  try {
    const { data: trustRows } = await admin
      .from('trust_transactions')
      .select('user_id, amount')
      .in('user_id', sellerIds)
      .gt('amount', 0) // earned (positive only)
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)

    for (const t of trustRows ?? []) {
      const uid = t.user_id as string
      trustMap[uid] = (trustMap[uid] ?? 0) + Number(t.amount ?? 0)
    }
  } catch {
    // trust_transactions table may not exist — silently skip TrustCoin totals
  }

  // ── Send one email per seller ─────────────────────────────────────────────────
  let sent = 0
  let skipped = 0

  for (const sellerId of sellerIds) {
    const profile = profileMap[sellerId]
    if (!profile) { skipped++; continue }

    const sellerOrders = sellerOrderMap[sellerId]

    // Compute stats
    let grossCents = 0
    let feeCents   = 0
    let netCents   = 0

    const statementOrders: MonthlyStatementOrder[] = sellerOrders.map(o => {
      const gross    = Number(o.amount_pence ?? 0)
      const feeRate  = String(o.item_type ?? '').toLowerCase() === 'product'
        ? FEE_RATE_PRODUCT
        : FEE_RATE_SERVICE
      const fee  = Math.round(gross * feeRate)
      const net  = gross - fee

      grossCents += gross
      feeCents   += fee
      netCents   += net

      return {
        invoiceNumber: o.invoice_number as string | null,
        date:          o.created_at as string,
        itemTitle:     o.item_title as string,
        grossCents:    gross,
        netCents:      net,
      }
    })

    // Sort orders descending by date for the email table
    statementOrders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const stats = {
      grossCents,
      feeCents,
      netCents,
      orderCount:       sellerOrders.length,
      trustCoinsEarned: trustMap[sellerId] ?? 0,
    }

    try {
      await sendMonthlyStatementEmail(
        profile.email,
        profile.full_name,
        priorMonthName,
        priorMonthYear,
        stats,
        statementOrders,
        sellerOrders.length,
      )
      sent++
      console.log(`[monthly-statement] sent to ${profile.email} (${sellerOrders.length} orders, €${(netCents / 100).toFixed(2)} net)`)
    } catch (err) {
      console.error(`[monthly-statement] failed for seller ${sellerId}:`, err)
      skipped++
    }
  }

  console.log(`[monthly-statement] done — sent=${sent} skipped=${skipped} sellers=${sellerIds.length}`)
  return NextResponse.json({
    month:   `${priorMonthName} ${priorMonthYear}`,
    sellers: sellerIds.length,
    sent,
    skipped,
  })
}
