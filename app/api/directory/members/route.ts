import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, bio, location, trust_balance, follower_count, skills')
      .order('trust_balance', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/directory/members]', error)
      return NextResponse.json({ members: [] })
    }

    const members = (data ?? []).map(p => ({
      id: p.id,
      type: 'individual' as const,
      full_name: p.full_name ?? null,
      username: p.username ?? null,
      avatar_url: p.avatar_url ?? null,
      bio: p.bio ?? null,
      location: p.location ?? null,
      trust_balance: p.trust_balance ?? null,
      follower_count: p.follower_count ?? null,
      skills: Array.isArray(p.skills) ? p.skills : [],
    }))

    return NextResponse.json({ members })
  } catch (err) {
    console.error('[GET /api/directory/members] unexpected error:', err)
    return NextResponse.json({ members: [] })
  }
}
