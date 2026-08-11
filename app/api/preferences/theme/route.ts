export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/preferences/theme — get the signed-in user's saved theme
// preference for cross-device sync. Returns default 'dark' for logged-out
// visitors or users with no saved row yet (table may also not exist yet on
// older environments — treated the same as "no preference saved").
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ theme: null })
    }

    const { data, error } = await supabase
      .from('user_preferences')
      .select('theme')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // 42P01 = table doesn't exist, PGRST116 = no row found — both just mean
      // "no saved preference", not a real error.
      if (error.code === '42P01' || error.code === 'PGRST116') {
        return NextResponse.json({ theme: null })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ theme: data?.theme ?? null })
  } catch (err) {
    console.error('GET /api/preferences/theme error:', err)
    return NextResponse.json({ theme: null })
  }
}

// PUT /api/preferences/theme — upsert the signed-in user's theme preference
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => null) as { theme?: string } | null
    const theme = body?.theme
    if (theme !== 'dark' && theme !== 'light') {
      return NextResponse.json({ error: 'theme must be "dark" or "light"' }, { status: 400 })
    }

    const { error } = await supabase
      .from('user_preferences')
      .upsert({ user_id: user.id, theme, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (error) {
      // Table missing on an environment that hasn't run the migration yet —
      // don't fail the request, the client still has localStorage.
      if (error.code === '42P01') {
        return NextResponse.json({ ok: false, synced: false })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, synced: true })
  } catch (err) {
    console.error('PUT /api/preferences/theme error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
