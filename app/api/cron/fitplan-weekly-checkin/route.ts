export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const admin = createAdminClient()
  const { data: profiles, error } = await admin
    .from('fitplan_profiles')
    .select('user_id, display_name')
    .eq('agreed_terms', true)
    .limit(250)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (profiles ?? []).map((profile: any) => ({
    user_id: profile.user_id,
    type: 'fitplan',
    title: 'FitPlan weekly check-in',
    body: 'Log your wins, blockers, and progress to keep your plan on track.',
    link: '/fitplan/dashboard?checkin=1',
    data: { source: 'fitplan_weekly_checkin' },
  }))
  if (rows.length > 0) {
    const { error: insertError } = await admin.from('notifications').insert(rows)
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, notified: rows.length })
}
