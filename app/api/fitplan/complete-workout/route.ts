export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduledWorkoutDate, todayKey } from '@/lib/fitplan/calendar'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { kind?: unknown; index?: unknown; completed?: unknown; scheduled_on?: unknown } | null
  const kind = body?.kind === 'meal' ? 'meal' : 'workout'
  const index = typeof body?.index === 'number' ? body.index : Number(body?.index)
  if (!Number.isInteger(index) || index < 0 || index > 50) return NextResponse.json({ error: `Invalid ${kind} index` }, { status: 400 })

  const admin = createAdminClient()
  const { data: plan, error: planError } = await admin
    .from('fitplan_plans')
    .select('id, plan_json, starts_on')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (planError) return NextResponse.json({ error: planError.message }, { status: 500 })
  if (!plan?.id) return NextResponse.json({ error: 'No active FitPlan found' }, { status: 404 })

  const planJson = (plan.plan_json && typeof plan.plan_json === 'object' && !Array.isArray(plan.plan_json)) ? plan.plan_json as Record<string, unknown> : {}
  const list = kind === 'meal' ? (planJson as { nutrition?: { meals?: unknown[] } }).nutrition?.meals : (planJson as { workouts?: unknown[] }).workouts
  if (Array.isArray(list) && index >= list.length) return NextResponse.json({ error: `${kind === 'meal' ? 'Meal' : 'Workout'} not found` }, { status: 404 })
  const field = kind === 'meal' ? 'completedMeals' : 'completedWorkouts'
  const previous = (planJson[field] && typeof planJson[field] === 'object' && !Array.isArray(planJson[field])) ? planJson[field] as Record<string, unknown> : {}
  const now = new Date().toISOString()
  const completed = body?.completed === true
  const today = todayKey()
  const start = typeof plan.starts_on === 'string' ? plan.starts_on.slice(0, 10) : (typeof (planJson as any).startDate === 'string' ? (planJson as any).startDate.slice(0, 10) : today)
  const item = Array.isArray(list) ? list[index] : null
  const fallbackScheduledOn = kind === 'workout'
    ? scheduledWorkoutDate(item, index, start)
    : today
  const scheduledOn = typeof body?.scheduled_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.scheduled_on) ? body.scheduled_on : fallbackScheduledOn
  const itemLabel = kind === 'workout'
    ? (item && typeof item === 'object' && 'focus' in item ? String((item as { focus?: unknown }).focus || `Workout ${index + 1}`) : `Workout ${index + 1}`)
    : String(item || `Meal ${index + 1}`).slice(0, 240)
  const nextCompletion = { ...previous, [String(index)]: completed ? { completed: true, completedOn: today, completedAt: now, scheduledOn } : { completed: false, completedOn: null, completedAt: now, scheduledOn } }
  const nextPlanJson = { ...planJson, [field]: nextCompletion }

  const { error: eventError } = await admin
    .from('fitplan_completion_events')
    .upsert({
      user_id: user.id,
      plan_id: plan.id,
      item_kind: kind,
      item_index: index,
      item_label: itemLabel,
      scheduled_on: scheduledOn,
      completed_on: today,
      completed_at: now,
      is_completed: completed,
    }, { onConflict: 'user_id,plan_id,item_kind,item_index' })

  if (eventError) return NextResponse.json({ error: eventError.message }, { status: 500 })

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
