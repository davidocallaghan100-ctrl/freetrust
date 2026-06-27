export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { kgFromInput, FITPLAN_COSTS } from '@/lib/fitplan/constants'
import { issueTrust } from '@/lib/fitplan/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  const admin = createAdminClient()
  const { data: plan } = await admin.from('fitplan_plans').select('id').eq('user_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle()
  const unit = body.weight_unit === 'lb' ? 'lb' : 'kg'
  const weight = typeof body.weight === 'number' ? body.weight : typeof body.weight === 'string' ? Number(body.weight) : NaN
  const payload = {
    user_id: user.id,
    plan_id: plan?.id ?? null,
    logged_on: typeof body.logged_on === 'string' ? body.logged_on : new Date().toISOString().slice(0, 10),
    weight_kg: kgFromInput(Number.isFinite(weight) ? weight : null, unit),
    energy: typeof body.energy === 'number' ? Math.min(10, Math.max(1, body.energy)) : null,
    mood: typeof body.mood === 'number' ? Math.min(10, Math.max(1, body.mood)) : null,
    sleep_hours: typeof body.sleep_hours === 'number' ? Math.min(24, Math.max(0, body.sleep_hours)) : null,
    workout_completed: body.workout_completed === true,
    nutrition_hit: body.nutrition_hit === true,
    notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 1200) : null,
    photos_private: body.photos_private !== false,
    share_to_feed: body.share_to_feed === true,
  }
  let feedPostId: string | null = null
  if (payload.share_to_feed) {
    const { data: post } = await admin.from('feed_posts').insert({ user_id: user.id, type: 'fitplan', title: 'FitPlan progress update', content: `FitPlan progress update 🏋️\n${payload.workout_completed ? 'Workout completed.\n' : ''}${payload.nutrition_hit ? 'Nutrition target hit.\n' : ''}${payload.notes ?? ''}`.trim(), trust_reward: 0 }).select('id').single()
    feedPostId = post?.id ?? null
  }
  const { data, error } = await admin.from('fitplan_progress').insert({ ...payload, feed_post_id: feedPostId }).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try {
    await issueTrust(user.id, FITPLAN_COSTS.progressReward, 'fitplan_progress_reward', data.id, 'FitPlan progress log reward')
  } catch (err) {
    console.warn('[FitPlan progress] reward skipped:', err)
  }
  return NextResponse.json({ progress: data })
}
