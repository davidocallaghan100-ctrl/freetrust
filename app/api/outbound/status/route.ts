export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ICP_CATEGORIES } from '@/lib/outbound/sequences'

// GET /api/outbound/status
// Returns outbound email sequence stats per ICP.
export async function GET() {
  try {
    const admin = createAdminClient()

    // Total counts by status
    const { data: statusCounts } = await admin
      .from('outbound_leads')
      .select('status')

    // Counts by ICP category
    const { data: icpCounts } = await admin
      .from('outbound_leads')
      .select('icp_category, status, sequence_step')

    // Emails sent count (sequence_step > 0 means at least 1 email sent)
    const totalLeads = statusCounts?.length ?? 0
    const emailsSent = (icpCounts ?? []).reduce((sum, l) => sum + (l.sequence_step ?? 0), 0)

    // Build per-ICP breakdown
    const byIcp: Record<string, {
      total: number
      new: number
      enrolled: number
      contacted: number
      replied: number
      booked: number
      unsubscribed: number
      step1_sent: number
      step2_sent: number
      step3_sent: number
    }> = {}

    for (const cat of ICP_CATEGORIES) {
      byIcp[cat] = { total: 0, new: 0, enrolled: 0, contacted: 0, replied: 0, booked: 0, unsubscribed: 0, step1_sent: 0, step2_sent: 0, step3_sent: 0 }
    }

    for (const row of icpCounts ?? []) {
      const cat = row.icp_category
      if (!cat || !byIcp[cat]) continue
      byIcp[cat].total++
      const status = row.status as string
      if (status in byIcp[cat]) {
        (byIcp[cat] as Record<string, number>)[status]++
      }
      if ((row.sequence_step ?? 0) >= 1) byIcp[cat].step1_sent++
      if ((row.sequence_step ?? 0) >= 2) byIcp[cat].step2_sent++
      if ((row.sequence_step ?? 0) >= 3) byIcp[cat].step3_sent++
    }

    // Status breakdown
    const statusBreakdown: Record<string, number> = {}
    for (const row of statusCounts ?? []) {
      const s = row.status as string
      statusBreakdown[s] = (statusBreakdown[s] ?? 0) + 1
    }

    return NextResponse.json({
      summary: {
        total_leads: totalLeads,
        emails_sent: emailsSent,
        status_breakdown: statusBreakdown,
      },
      by_icp: byIcp,
    })
  } catch (err) {
    console.error('[/api/outbound/status] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
