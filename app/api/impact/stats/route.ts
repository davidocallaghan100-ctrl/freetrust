export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const [projectsRes, donationsRes, membersRes] = await Promise.all([
      supabase.from('impact_projects').select('raised, goal, backers').eq('status', 'active'),
      supabase.from('impact_donations').select('amount'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])

    const projects = projectsRes.data ?? []
    const totalRaised = projects.reduce((s, p) => s + Number(p.raised ?? 0), 0)
    const totalBackers = projects.reduce((s, p) => s + Number(p.backers ?? 0), 0)
    const activeProjects = projects.length

    const donationTotal = (donationsRes.data ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0)
    const memberCount = membersRes.count ?? 0

    // Current quarter donations
    const now = new Date()
    const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    const { data: qDonations } = await supabase
      .from('impact_donations')
      .select('amount')
      .gte('created_at', quarterStart.toISOString())
    const quarterlyTotal = (qDonations ?? []).reduce((s, d) => s + Number(d.amount ?? 0), 0)
    const quarterlyGoal = 20000
    const quarterlyPct = Math.min(Math.round((quarterlyTotal / quarterlyGoal) * 100), 100)

    // Fund balance (raised + donations - nothing withdrawn yet)
    const fundBalance = totalRaised + donationTotal

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
