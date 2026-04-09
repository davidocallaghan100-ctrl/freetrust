import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    // Try by UUID first, then by slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    const { data, error } = isUUID
      ? await supabase
          .from('organisations')
          .select('*, creator:profiles!creator_id(id, full_name, avatar_url, trust_balance)')
          .eq('id', id)
          .maybeSingle()
      : await supabase
          .from('organisations')
          .select('*, creator:profiles!creator_id(id, full_name, avatar_url, trust_balance)')
          .eq('slug', id)
          .maybeSingle()

    if (error) {
      console.error('[GET /api/organisations/[id]]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
    }

    // Check if current user is following
    const { data: { user } } = await supabase.auth.getUser()
    let isFollowing = false
    if (user) {
      try {
        const { data: follow } = await supabase
          .from('organisation_follows')
          .select('id')
          .eq('organisation_id', data.id)
          .eq('user_id', user.id)
          .maybeSingle()
        isFollowing = !!follow
      } catch {
        // organisation_follows table may not exist yet — silently ignore
        isFollowing = false
      }
    }

    return NextResponse.json({ ...data, isFollowing, userId: user?.id ?? null })
  } catch (err) {
    console.error('[GET /api/organisations/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
