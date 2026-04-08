import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/settings/notifications — update notification_prefs JSONB column
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    const allowed = [
      'email_digest',
      'push_notifications',
      'message_alerts',
      'trust_alerts',
      'follower_alerts',
      'clap_alerts',
    ] as const
    type AllowedKey = typeof allowed[number]
    const prefs: Partial<Record<AllowedKey, unknown>> = {}
    for (const key of allowed) {
      if (key in body) prefs[key] = body[key]
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        notification_prefs: prefs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('notification_prefs')
      .single()

    if (error) {
      console.error('[PATCH /api/settings/notifications]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notification_prefs: profile.notification_prefs })
  } catch (err) {
    console.error('[PATCH /api/settings/notifications] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
