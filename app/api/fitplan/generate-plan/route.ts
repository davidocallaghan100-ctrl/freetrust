export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FITPLAN_COSTS, FITPLAN_MODEL } from '@/lib/fitplan/constants'
import { awardFitPlanBadge, refundTrust, spendTrust } from '@/lib/fitplan/server'
import { generateFitPlan } from '@/lib/fitplan/ai'

export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin.from('fitplan_profiles').select('*').eq('user_id', user.id).maybeSingle()
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
  if (!profile?.agreed_terms) return NextResponse.json({ error: 'Complete FitPlan onboarding first' }, { status: 400 })

  try {
    await spendTrust(user.id, FITPLAN_COSTS.planGeneration, 'fitplan_generate_plan', 'FitPlan AI plan generation')
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    const balanceRes = await admin.from('trust_balances').select('balance').eq('user_id', user.id).maybeSingle()
    return NextResponse.json({ error: msg.includes('insufficient_funds') ? 'Insufficient Trust Coins' : msg, code: msg.includes('insufficient_funds') ? 'insufficient_funds' : 'spend_failed', balance: balanceRes.data?.balance ?? 0, required: FITPLAN_COSTS.planGeneration }, { status: msg.includes('insufficient_funds') ? 402 : 500 })
  }

  try {
    const plan = await generateFitPlan(profile as any)
    await admin.from('fitplan_plans').update({ status: 'archived' }).eq('user_id', user.id).eq('status', 'active')
    const { data, error } = await admin.from('fitplan_plans').insert({
      user_id: user.id,
      status: 'active',
      model: FITPLAN_MODEL,
      goal: profile.goal,
      summary: plan.summary,
      plan_json: plan,
      cost_trust: FITPLAN_COSTS.planGeneration,
      doctor_clearance: profile.doctor_clearance,
    }).select('*').single()
    if (error) throw error
    await awardFitPlanBadge(user.id)
    return NextResponse.json({ plan: data })
  } catch (err) {
    await refundTrust(user.id, FITPLAN_COSTS.planGeneration, 'fitplan_generate_plan_refund', 'Refund: FitPlan plan generation failed')
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[FitPlan generate-plan] failed:', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
