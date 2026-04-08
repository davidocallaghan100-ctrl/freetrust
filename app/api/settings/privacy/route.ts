import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/settings/privacy — update privacy_settings JSONB column
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Only allow known privacy keys
    const allowed = ['profile_visibility', 'show_trust_score', 'show_online_status'] as const
    type AllowedKey = typeof allowed[number]
    const privacy: Partial<Record<AllowedKey, unknown>> = {}
    for (const key of allowed) {
      if (key in body) privacy[key] = body[key]
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        privacy_settings: privacy,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('privacy_settings')
      .single()

    if (error) {
      console.error('[PATCH /api/settings/privacy]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ privacy_settings: profile.privacy_settings })
  } catch (err) {
    console.error('[PATCH /api/settings/privacy] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
