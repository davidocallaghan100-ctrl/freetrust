export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'

// POST /api/users/[id]/follow — toggle follow on a user
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (user.id === targetId) {
    return NextResponse.json({ error: 'Cannot follow yourself' }, { status: 400 })
  }

  try {
    // Check existing
    const { data: existing, error: fetchErr } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[user follow] fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (existing) {
      // Unfollow
      const { error: delErr } = await supabase
        .from('user_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId)

      if (delErr) {
        console.error('[user follow] delete error:', delErr)
        return NextResponse.json({ error: delErr.message }, { status: 500 })
      }
      return NextResponse.json({ following: false })
    }

    // Follow
    const { error: insertErr } = await supabase
      .from('user_follows')
      .insert({ follower_id: user.id, following_id: targetId })

    if (insertErr) {
      console.error('[user follow] insert error:', insertErr)
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Fire-and-forget new_follower email (non-critical; preference-checked)
    const { data: follower } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const followerName = follower?.full_name ?? 'Someone'
    sendEmail({
      type: 'new_follower',
      userId: targetId,
      payload: { followerName, followerId: user.id },
    }).catch(() => { /* sendEmail already swallows, but safety net */ })

    return NextResponse.json({ following: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/users/[id]/follow]', message)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/users/[id]/follow — explicitly unfollow
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', targetId)

  if (error) {
    console.error('[user unfollow] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ following: false })
}

// GET /api/users/[id]/follow — get current follow state
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Public follower count
  const { count: followers } = await supabase
    .from('user_follows')
    .select('id', { count: 'exact', head: true })
    .eq('following_id', targetId)

  if (!user) {
    return NextResponse.json({ following: false, followers: followers ?? 0 })
  }

  const { data: existing } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle()

  return NextResponse.json({
    following: !!existing,
    followers: followers ?? 0,
  })
}
