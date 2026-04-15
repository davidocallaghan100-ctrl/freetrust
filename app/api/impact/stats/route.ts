export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/impact/stats — Sustainability Fund + impact project totals
//
// Before the integrity audit this route computed:
//   fundBalance = totalRaised + donationTotal
// where totalRaised was Σ(impact_projects.raised) and donationTotal
// was Σ(impact_donations.amount). Every donation increments BOTH
// `impact_projects.raised` AND inserts a new `impact_donations`
// row, so the fund balance was DOUBLE-COUNTED. Worse, the
// `impact_projects.raised` column was seeded with mock numbers
// (€142,800, €87,400, etc.) so the displayed "Sustainability Fund
// Balance" was a meaningless mix of seed data and a 2× real-donation
// amount.
//
// Fixed by reading from the canonical singleton table
// `impact_fund_balance` (added by 20260414000009_trust_economy_audit.sql)
// which is the single source of truth for the global fund pool.
// The donate_to_impact_fund() RPC is the only path that mutates it,
// and it does so atomically alongside every user debit and project
// raised increment so the three numbers can never drift.
export async function GET() {
  try {
    const supabase = await createClient()

    const [projectsRes, donationsRes, membersRes, fundBalRes] = await Promise.all([
      supabase.from('impact_projects').select('raised, goal, backers').eq('status', 'active'),
      supabase.from('impact_donations').select('amount'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      // Singleton row id=1 — the canonical fund pool.
      supabase
        .from('impact_fund_balance')
        .select('balance, lifetime, updated_at')
        .eq('id', 1)
        .maybeSingle(),
    ])

    const projects = projectsRes.data ?? []
    const totalRaised = projects.reduce((s, p) => s + Number(p.raised ?? 0), 0)
    const totalBackers = projects.reduce((s, p) => s + Number(p.backers ?? 0), 0)
    const activeProjects = projects.length
    const memberCount = membersRes.count ?? 0

    // Current quarter donations — used for the "X% to quarterly goal"
    // progress bar on /impact. Read from impact_donations directly
    // because that table is the per-event log; the singleton fund
    // balance row is a running total and doesn't carry timestamps.
    const now = new Date()
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const { data: qDonations } = await supabase
      .from('impact_donations')
      .select('amount')
      .gte('created_at', quarterStart.toISOString())
    const quarterlyTotal = (qDonations ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0)
    const quarterlyGoal = 20000
    const quarterlyPct = Math.min(Math.round((quarterlyTotal / quarterlyGoal) * 100), 100)

    // Read the canonical fund balance from the singleton table.
    // Fall back to the donations sum (NOT projects.raised, which
    // includes seed mock data) if the table is missing — e.g. on
    // a dev DB that hasn't run the audit migration yet.
    const fundBalance = fundBalRes?.data?.lifetime != null
      ? Number(fundBalRes.data.lifetime)
      : (donationsRes.data ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0)

    return NextResponse.json({
      totalRaised,
      totalBackers,
      activeProjects,
      memberCount,
      fundBalance,
      quarterlyTotal,
      quarterlyGoal,
      quarterlyPct,
    })
  } catch (err) {
    console.error('[GET /api/impact/stats]', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
