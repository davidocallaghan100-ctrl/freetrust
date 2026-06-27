export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanStringArray, fitPlanCostsSummary, getTrustBalance } from '@/lib/fitplan/server'
import { kgFromInput } from '@/lib/fitplan/constants'
import { buildFitPlanCalendar } from '@/lib/fitplan/calendar'

const ALLOWED_GOALS = new Set([
  'fat_loss',
  'muscle_gain',
  'strength',
  'endurance',
  'general_wellness',
  'mobility',
  'energy',
  'nutrition',
])

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asNumber(value: unknown) {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN
  return Number.isFinite(n) ? n : null
}

function cleanGoals(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const goals = raw
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(goal => ALLOWED_GOALS.has(goal))
  return Array.from(new Set(goals)).slice(0, 5)
}

async function getUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [profileRes, planRes, progressRes, checkinsRes, messagesRes, completionsRes, balance] = await Promise.all([
    admin.from('fitplan_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    admin.from('fitplan_plans').select('*').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    admin.from('fitplan_progress').select('*').eq('user_id', user.id).order('logged_on', { ascending: false }).limit(30),
    admin.from('fitplan_checkins').select('*').eq('user_id', user.id).order('week_start', { ascending: false }).limit(12),
    admin.from('fitplan_coach_messages').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(12),
    admin.from('fitplan_completion_events').select('*').eq('user_id', user.id).order('completed_on', { ascending: false }).limit(500),
    getTrustBalance(user.id),
  ])

  const completions = completionsRes.data ?? []
  const calendar = buildFitPlanCalendar({
    plan: planRes.data,
    completions,
    progress: progressRes.data ?? [],
    checkins: checkinsRes.data ?? [],
  })

  return NextResponse.json({
    profile: profileRes.data ?? null,
    activePlan: planRes.data ?? null,
    progress: progressRes.data ?? [],
    checkins: checkinsRes.data ?? [],
    messages: (messagesRes.data ?? []).reverse(),
    completions,
    calendar,
    trustBalance: balance,
    costs: fitPlanCostsSummary(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

  const agreedTerms = body.agreed_terms === true
  if (!agreedTerms) return NextResponse.json({ error: 'FitPlan terms must be accepted' }, { status: 400 })

  const weightUnit = body.weight_unit === 'lb' ? 'lb' : 'kg'
  const weightInput = asNumber(body.weight)
  const goals = cleanGoals(body.goals)
  const primaryGoal = goals[0] ?? asString(body.goal, 'general_wellness').slice(0, 80)
  const payload = {
    user_id: user.id,
    display_name: asString(body.display_name, user.email?.split('@')[0] ?? 'FreeTrust member').slice(0, 120),
    goal: primaryGoal,
    goals: goals.length ? goals : [primaryGoal],
    experience_level: asString(body.experience_level, 'beginner').slice(0, 40),
    training_days: Math.min(7, Math.max(1, asNumber(body.training_days) ?? 3)),
    preferred_workout_minutes: Math.min(180, Math.max(10, asNumber(body.preferred_workout_minutes) ?? 35)),
    equipment: cleanStringArray(body.equipment),
    dietary_preferences: cleanStringArray(body.dietary_preferences),
    allergies: cleanStringArray(body.allergies),
    injuries: asString(body.injuries).slice(0, 1000) || null,
    doctor_clearance: body.doctor_clearance === 'yes' || body.doctor_clearance === 'no' ? body.doctor_clearance : 'unknown',
    birth_year: asNumber(body.birth_year),
    height_cm: asNumber(body.height_cm),
    weight_kg: kgFromInput(weightInput, weightUnit),
    weight_unit: weightUnit,
    progress_photos_private: body.progress_photos_private !== false,
    share_updates_default: body.share_updates_default === true,
    agreed_terms: agreedTerms,
    terms_version: 'fitplan-2026-06-27-safety-v2',
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('fitplan_profiles')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    console.error('[FitPlan profile] save failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
