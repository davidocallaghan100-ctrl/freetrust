export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/users/search?q=... — search users by name, username, or email
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim()
    if (!q || q.length < 2) {
      return NextResponse.json({ users: [] })
    }

    const searchTerm = `%${q}%`

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, username, email, avatar_url')
      .neq('id', user.id) // exclude self
      .or(`full_name.ilike.${searchTerm},username.ilike.${searchTerm},email.ilike.${searchTerm}`)
      .limit(10)

    if (error) {
      console.error('[GET /api/users/search]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Only return safe fields
    const users = (data ?? []).map(p => ({
      id: p.id,
      full_name: p.full_name,
      username: p.username,
      avatar_url: p.avatar_url,
    }))

    return NextResponse.json({ users })
  } catch (err) {
    console.error('[GET /api/users/search]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
