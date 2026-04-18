export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

// GET /api/campaigns/[id] — fetch campaign details + send stats
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const admin = createAdminClient()

    const [campaignRes, sendsRes] = await Promise.all([
      admin.from('campaigns').select('*').eq('id', params.id).maybeSingle(),
      admin
        .from('campaign_sends')
        .select('status, count:id', { count: 'exact', head: false })
        .eq('campaign_id', params.id),
    ])

    if (campaignRes.error || !campaignRes.data) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Summarise send stats
    const sends = sendsRes.data ?? []
    const stats = {
      total: sends.length,
      sent: sends.filter((s: { status: string }) => s.status === 'sent').length,
      failed: sends.filter((s: { status: string }) => s.status === 'failed').length,
      pending: sends.filter((s: { status: string }) => s.status === 'pending').length,
    }

    return NextResponse.json({ campaign: campaignRes.data, stats })
  } catch (err) {
    console.error('[GET /api/campaigns/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/campaigns/[id] — update a draft campaign
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const body = await req.json() as Record<string, unknown>

    const allowed = ['name', 'subject', 'body_html', 'segment', 'scheduled_at', 'status'] as const
    const updates: Partial<Record<typeof allowed[number], unknown>> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const admin = createAdminClient()

    // Only allow patching draft or scheduled campaigns
    const { data: existing } = await admin
      .from('campaigns')
      .select('status')
      .eq('id', params.id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (existing.status === 'sending' || existing.status === 'sent') {
      return NextResponse.json({ error: 'Cannot edit a campaign that is sending or already sent' }, { status: 409 })
    }

    const { data: campaign, error: dbErr } = await admin
      .from('campaigns')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (dbErr) {
      console.error('[PATCH /api/campaigns/[id]] db error:', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    return NextResponse.json({ campaign })
  } catch (err) {
    console.error('[PATCH /api/campaigns/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/campaigns/[id] — delete a draft campaign
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const admin = createAdminClient()

    const { data: existing } = await admin
      .from('campaigns')
      .select('status')
      .eq('id', params.id)
      .maybeSingle()

    if (!existing) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (existing.status === 'sending') {
      return NextResponse.json({ error: 'Cannot delete a campaign currently sending' }, { status: 409 })
    }

    const { error: dbErr } = await admin.from('campaigns').delete().eq('id', params.id)
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/campaigns/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
