export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/trust/reconcile — admin reconciliation report
//
// Reads the trust_reconciliation view (created by
// 20260414000009_trust_economy_audit.sql) which joins
// profiles + trust_balances + trust_ledger and computes the
// discrepancy between recorded balance and ledger sum for every
// user. Use this endpoint to:
//
//   * Spot users whose recorded balance != Σ(ledger entries)
//     — indicates a partial-write bug or out-of-band mutation
//   * Find users with zero balance who should have earned
//     (created entities but no ledger entries — same family of
//     bug as Mags / Cliff)
//   * Compute total trust supply (sum of recorded_balance) vs
//     total trust ever issued (sum of recorded_lifetime) for
//     reconciliation against the impact_fund_balance pool
//
// Admin gated. Returns JSON with one row per user plus aggregate
// totals. Designed for the operator's local CLI / curl, not a
// production dashboard — for that use a Postgres SUM aggregate
// straight from the view.
export async function GET() {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: caller, error: callerErr } = await admin
      .from('profiles')
      .select('id, is_admin')
      .eq('id', user.id)
      .maybeSingle()

    if (callerErr) {
      return NextResponse.json({ error: callerErr.message }, { status: 500 })
    }
    if (!caller || caller.is_admin !== true) {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    // Pull every reconciliation row. Cap to 1000 — the operator can
    // page if the platform ever grows past that. Sort by absolute
    // discrepancy descending so the worst drift sits at the top.
    const { data: rows, error: rowsErr } = await admin
      .from('trust_reconciliation')
      .select('*')
      .order('balance_discrepancy', { ascending: false })
      .limit(1000)

    if (rowsErr) {
      return NextResponse.json({ error: rowsErr.message }, { status: 500 })
    }

    const list = (rows ?? []) as Array<{
      user_id: string
      full_name: string | null
      recorded_balance: number
      recorded_lifetime: number
      ledger_sum: number
      ledger_lifetime: number
      balance_discrepancy: number
      ledger_entry_count: number
      last_ledger_at: string | null
    }>

    const totals = list.reduce(
      (acc, r) => {
        acc.totalRecordedBalance  += r.recorded_balance ?? 0
        acc.totalRecordedLifetime += r.recorded_lifetime ?? 0
        acc.totalLedgerSum        += r.ledger_sum ?? 0
        acc.usersWithDiscrepancy  += (r.balance_discrepancy ?? 0) !== 0 ? 1 : 0
        acc.usersWithZeroBalance  += (r.recorded_balance ?? 0) === 0 ? 1 : 0
        return acc
      },
      { totalRecordedBalance: 0, totalRecordedLifetime: 0, totalLedgerSum: 0, usersWithDiscrepancy: 0, usersWithZeroBalance: 0 }
    )

    // Pull the impact fund pool for cross-reference. Total ledger
    // sum + impact fund lifetime should equal total recorded
    // lifetime if the donate path is wired correctly (every user
    // debit is mirrored by a fund credit of the same magnitude).
    const { data: fundRow } = await admin
      .from('impact_fund_balance')
      .select('balance, lifetime, updated_at')
      .eq('id', 1)
      .maybeSingle()

    return NextResponse.json({
      generated_at: new Date().toISOString(),
      summary: {
        ...totals,
        userCount: list.length,
        impactFundBalance: fundRow?.balance ?? 0,
        impactFundLifetime: fundRow?.lifetime ?? 0,
      },
      // Only return rows with discrepancies + zero-balance users
      // by default — the full list would explode the response on
      // a populated DB. Operators who want everything can hit the
      // view directly via psql.
      discrepancies: list.filter(r => (r.balance_discrepancy ?? 0) !== 0),
      zero_balance_users: list.filter(r => (r.recorded_balance ?? 0) === 0).slice(0, 100),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GET /api/admin/trust/reconcile]', msg, err)
    return NextResponse.json({ error: `Internal error: ${msg}` }, { status: 500 })
  }
}
