export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { index?: unknown; completed?: unknown } | null
  const index = typeof body?.index === 'number' ? body.index : Number(body?.index)
  if (!Number.isInteger(index) || index < 0 || index > 13) return NextResponse.json({ error: 'Invalid workout index' }, { status: 400 })

  const admin = createAdminClient()
  const { data: plan, error: planError } = await admin
    .from('fitplan_plans')
    .select('id, plan_json')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
  if (!plan?.id) return NextResponse.json({ error: 'No active FitPlan found' }, { status: 404 })

  const planJson = (plan.plan_json && typeof plan.plan_json === 'object' && !Array.isArray(plan.plan_json)) ? plan.plan_json as Record<string, unknown> : {}
  const previous = (planJson.completedWorkouts && typeof planJson.completedWorkouts === 'object' && !Array.isArray(planJson.completedWorkouts)) ? planJson.completedWorkouts as Record<string, unknown> : {}
  const completedWorkouts = { ...previous, [String(index)]: body?.completed === true }
  const nextPlanJson = { ...planJson, completedWorkouts }

  const { data, error } = await admin
    .from('fitplan_plans')
    .update({ plan_json: nextPlanJson })
    .eq('id', plan.id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data })
}
