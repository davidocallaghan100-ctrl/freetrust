import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: org_id } = params

    // Check if already following
    const { data: existing } = await supabase
      .from('organisation_follows')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('org_id', org_id)
      .single()

    if (existing) {
      // Unfollow
      await supabase
        .from('organisation_follows')
        .delete()
        .eq('user_id', user.id)
        .eq('org_id', org_id)

      await supabase
        .from('organisations')
        .update({ follower_count: supabase.rpc('follower_count - 1') as unknown as number })
        .eq('id', org_id)

      return NextResponse.json({ following: false })
    } else {
      // Follow
      await supabase
        .from('organisation_follows')
        .insert({ user_id: user.id, org_id })

      return NextResponse.json({ following: true })
    }
  } catch (error) {
    console.error('Follow error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
