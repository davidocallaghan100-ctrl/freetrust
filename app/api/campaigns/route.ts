export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ── Auth helper ────────────────────────────────────────────────────────────────
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { user: null, error: 'Unauthorized' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || profile.role !== 'admin') return { user: null, error: 'Forbidden' }
  return { user, error: null }
}

// GET /api/campaigns — list all campaigns (admin only)
export async function GET(_req: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const admin = createAdminClient()
    const { data: campaigns, error: dbErr } = await admin
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false })

    if (dbErr) {
      console.error('[GET /api/campaigns] db error:', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ campaigns: campaigns ?? [] })
  } catch (err) {
    console.error('[GET /api/campaigns] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/campaigns — create a draft campaign
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await req.json() as {
      name?: string
      subject?: string
      body_html?: string
      segment?: string
      scheduled_at?: string | null
    }

    if (!body.name || !body.subject || !body.body_html) {
      return NextResponse.json({ error: 'Missing required fields: name, subject, body_html' }, { status: 400 })
    }

    const validSegments = ['all', 'inactive_7d', 'inactive_30d', 'zero_trust', 'no_purchase']
    const segment = body.segment && validSegments.includes(body.segment) ? body.segment : 'all'

    const admin = createAdminClient()
    const { data: campaign, error: dbErr } = await admin
      .from('campaigns')
      .insert({
        name: body.name,
        subject: body.subject,
        body_html: body.body_html,
        segment,
        status: body.scheduled_at ? 'scheduled' : 'draft',
        scheduled_at: body.scheduled_at ?? null,
        created_by: user.id,
      })
      .select()
      .single()

    if (dbErr || !campaign) {
      console.error('[POST /api/campaigns] db error:', dbErr)
      return NextResponse.json({ error: dbErr?.message ?? 'Failed to create campaign' }, { status: 500 })
    }

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/campaigns] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
