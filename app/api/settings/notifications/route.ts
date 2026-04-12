export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { EMAIL_TYPE_LABELS, type EmailType } from '@/lib/email/send'

// GET /api/settings/notifications
// Returns the current user's per-type preferences merged with defaults
// (missing row = opt-in). Backed by the notification_preferences table.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: rows } = await admin
      .from('notification_preferences')
      .select('type, email_enabled, push_enabled')
      .eq('user_id', user.id)

    const byType: Record<string, { email_enabled: boolean; push_enabled: boolean }> = {}
    for (const r of rows ?? []) {
      byType[(r as { type: string }).type] = {
        email_enabled: (r as { email_enabled: boolean }).email_enabled,
        push_enabled: (r as { push_enabled: boolean }).push_enabled,
      }
    }

    const preferences = (Object.keys(EMAIL_TYPE_LABELS) as EmailType[]).map(type => ({
      type,
      label: EMAIL_TYPE_LABELS[type].label,
      description: EMAIL_TYPE_LABELS[type].description,
      category: EMAIL_TYPE_LABELS[type].category,
      email_enabled: byType[type]?.email_enabled ?? true,
      push_enabled: byType[type]?.push_enabled ?? true,
    }))

    return NextResponse.json({ preferences })
  } catch (err) {
    console.error('[GET /api/settings/notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/settings/notifications
// Body: { type: EmailType, email_enabled?: boolean, push_enabled?: boolean }
// Upserts a single preference row. Used by the per-type toggle switches.
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({})) as {
      type?: string
      email_enabled?: boolean
      push_enabled?: boolean
    }

    if (!body.type || !(body.type in EMAIL_TYPE_LABELS)) {
      return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
    }

    const admin = createAdminClient()
    const row: Record<string, unknown> = {
      user_id: user.id,
      type: body.type,
      updated_at: new Date().toISOString(),
    }
    if (typeof body.email_enabled === 'boolean') row.email_enabled = body.email_enabled
    if (typeof body.push_enabled === 'boolean') row.push_enabled = body.push_enabled

    const { error } = await admin
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id,type' })

    if (error) {
      console.error('[PUT /api/settings/notifications] upsert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[PUT /api/settings/notifications]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/settings/notifications — legacy: update notification_prefs JSONB
// column on the profiles table. Kept for backward compat with the existing
// NotificationsTab component. New code should use PUT with per-type rows.
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
