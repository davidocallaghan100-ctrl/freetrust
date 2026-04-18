export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeCampaignSend } from '@/lib/campaigns/send'

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

// POST /api/campaigns/[id]/send — manually trigger a campaign send
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: error === 'Unauthorized' ? 401 : 403 })

  try {
    const admin = createAdminClient()

    // Validate campaign exists and is in a sendable state
    const { data: campaign } = await admin
      .from('campaigns')
      .select('status, name')
      .eq('id', params.id)
      .maybeSingle()

    if (!campaign) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    if (campaign.status === 'sending') {
      return NextResponse.json({ error: 'Campaign is already sending' }, { status: 409 })
    }
    if (campaign.status === 'sent') {
      return NextResponse.json({ error: 'Campaign has already been sent' }, { status: 409 })
    }

    // Execute send (this may take a while for large audiences — runs synchronously
    // within the request. For production scale, move to a background job).
    const result = await executeCampaignSend(params.id)

    return NextResponse.json({
      success: true,
      campaignId: params.id,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/campaigns/[id]/send] error:', message)

    // Mark campaign as failed if something went wrong
    try {
      const admin = createAdminClient()
      await admin
        .from('campaigns')
        .update({ status: 'failed' })
        .eq('id', params.id)
        .eq('status', 'sending') // only if it got stuck in sending
    } catch { /* ignore */ }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
