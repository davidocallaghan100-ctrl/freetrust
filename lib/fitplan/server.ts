import { createAdminClient } from '@/lib/supabase/admin'
import { FITPLAN_COSTS, FITPLAN_PLAN_DURATIONS } from '@/lib/fitplan/constants'

export type FitPlanProfile = {
  user_id: string
  display_name?: string | null
  goal: string
  goals?: string[] | null
  experience_level: string
  training_days: number
  preferred_workout_minutes: number
  equipment: string[]
  dietary_preferences: string[]
  allergies: string[]
  injuries?: string | null
  doctor_clearance: 'yes' | 'no' | 'unknown'
  birth_year?: number | null
  height_cm?: number | null
  weight_kg?: number | null
  weight_unit: 'kg' | 'lb'
  progress_photos_private: boolean
  share_updates_default: boolean
  agreed_terms: boolean
}

export function cleanStringArray(value: unknown, max = 12) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => typeof item === 'string' ? item.trim() : '')
    .filter(Boolean)
    .slice(0, max)
}

export async function getTrustBalance(userId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('get_trust_coin_balance', { p_user_id: userId })
  if (error) {
    const { data: row } = await admin.from('trust_balances').select('balance').eq('user_id', userId).maybeSingle()
    return row?.balance ?? 0
  }
  return typeof data === 'number' ? data : 0
}

export async function spendTrust(userId: string, amount: number, type: string, desc: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('spend_trust', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_desc: desc,
  })
  if (error) throw error
  return typeof data === 'number' ? data : null
}

export async function issueTrust(userId: string, amount: number, type: string, ref: string | null, desc: string) {
  const admin = createAdminClient()
  const { error } = await admin.rpc('issue_trust', {
    p_user_id: userId,
    p_amount: amount,
    p_type: type,
    p_ref: ref,
    p_desc: desc,
  })
  if (error) throw error
}

export async function refundTrust(userId: string, amount: number, type: string, desc: string) {
  try {
    await issueTrust(userId, amount, type, null, desc)
  } catch (err) {
    console.error('[FitPlan] Trust refund failed:', err)
  }
}

export async function awardFitPlanBadge(userId: string) {
  const admin = createAdminClient()
  const badge = 'fitplan_commitment'
  const { data: existing } = await admin
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge', badge)
    .maybeSingle()

  if (existing?.id) return false

  const { error } = await admin.from('user_badges').insert({ user_id: userId, badge })
  if (error) {
    console.warn('[FitPlan] badge insert skipped:', error.message)
    return false
  }
  await admin.from('notifications').insert({
    user_id: userId,
    type: 'badge',
    title: '🏅 FitPlan Commitment badge earned',
    body: 'You unlocked the FitPlan Commitment badge for starting your plan.',
    link: '/fitplan/dashboard',
    data: { badge },
  })
  return true
}

export async function getActiveFitPlan(userId: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('fitplan_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

export function fitPlanSafetyNote(profile: Pick<FitPlanProfile, 'doctor_clearance' | 'injuries'> | null | undefined) {
  if (profile?.doctor_clearance === 'no') {
    return 'Safety flag: user said they do not have doctor clearance. Advise GP/qualified professional clearance before training, avoid intense prescriptions, and keep suggestions gentle and informational.'
  }
  if (profile?.injuries?.trim()) {
    return 'Safety flag: user reported injuries or limitations. Avoid diagnosis. Suggest modifications and qualified medical/physio guidance where appropriate.'
  }
  return 'General safety: do not diagnose, treat disease, or present medical advice. Recommend professional support for pain, symptoms, pregnancy, eating disorder concerns, or medical conditions.'
}

export function fitPlanCostsSummary() {
  return {
    planGeneration: FITPLAN_COSTS.planGeneration,
    planGenerationWeekly: FITPLAN_COSTS.planGenerationWeekly,
    planGenerationMonthly: FITPLAN_COSTS.planGenerationMonthly,
    planGenerationQuarterly: FITPLAN_COSTS.planGenerationQuarterly,
    planDurations: FITPLAN_PLAN_DURATIONS,
    coachMessage: FITPLAN_COSTS.coachMessage,
    checkinReward: FITPLAN_COSTS.checkinReward,
    progressReward: FITPLAN_COSTS.progressReward,
  }
}
