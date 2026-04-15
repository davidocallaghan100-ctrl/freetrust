export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/impact/stats — aggregate stats for the /impact page hero.
//
// fundBalance + fundLifetime are read from the impact_fund_balance
// singleton row (id = 1), NOT computed from project.raised + donations.
// The previous implementation computed
//     fundBalance = SUM(impact_projects.raised) + SUM(impact_donations.amount)
// which double-counted every donation (the donate flow updates BOTH
// the project row AND inserts a donations row) and was seeded with
// the euro values of the project goals, so the displayed number was
// always meaningless. See migration 20260415000008_impact_fund_fix.sql
// for the full root-cause writeup.
export async function GET() {
  try {
    const supabase = await createClient()

    const [projectsRes, fundRes, membersRes, donationsRes] = await Promise.all([
      supabase
        .from('impact_projects')
        .select('raised, goal, backers')
        .eq('status', 'active'),
      supabase
        .from('impact_fund_balance')
        .select('balance, lifetime')
        .eq('id', 1)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('impact_donations')
        .select('amount, created_at'),
    ])

    const projects      = projectsRes.data ?? []
    const totalRaised   = projects.reduce((s, p) => s + Number(p.raised  ?? 0), 0)
    const totalBackers  = projects.reduce((s, p) => s + Number(p.backers ?? 0), 0)
    const activeProjects = projects.length

    // Authoritative fund balance — read from the singleton.
    const fundBalance  = Number(fundRes.data?.balance  ?? 0)
    const fundLifetime = Number(fundRes.data?.lifetime ?? 0)

    const memberCount = membersRes.count ?? 0

    // Quarter-to-date donations for the progress bar.
    const now = new Date()
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const quarterStartMs = quarterStart.getTime()
    const quarterlyTotal = (donationsRes.data ?? []).reduce((s, d) => {
      const created = d.created_at ? new Date(d.created_at as string).getTime() : 0
      return created >= quarterStartMs ? s + Number(d.amount ?? 0) : s
    }, 0)
    const quarterlyGoal = 20000
    const quarterlyPct  = Math.min(Math.round((quarterlyTotal / quarterlyGoal) * 100), 100)

    return NextResponse.json({
      totalRaised,
      totalBackers,
      activeProjects,
      memberCount,
      fundBalance,
      fundLifetime,
      quarterlyTotal,
      quarterlyGoal,
      quarterlyPct,
    })
  } catch (err) {
    console.error('[GET /api/impact/stats]', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}
