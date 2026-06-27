export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildFitPlanCalendar } from '@/lib/fitplan/calendar'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [planRes, progressRes, checkinsRes, completionsRes] = await Promise.all([
    admin.from('fitplan_plans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('fitplan_progress').select('*').eq('user_id', user.id).order('logged_on', { ascending: false }).limit(120),
    admin.from('fitplan_checkins').select('*').eq('user_id', user.id).order('week_start', { ascending: false }).limit(24),
    admin.from('fitplan_completion_events').select('*').eq('user_id', user.id).order('completed_on', { ascending: false }).limit(800),
  ])

  const calendar = buildFitPlanCalendar({
    plan: planRes.data,
    progress: progressRes.data ?? [],
    checkins: checkinsRes.data ?? [],
    completions: completionsRes.data ?? [],
  })

  return NextResponse.json({
    activePlan: planRes.data ?? null,
    calendar,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
