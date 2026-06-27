export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeCampaignSend } from '@/lib/campaigns/send'
import { requireFreeTrustAdmin } from '@/lib/admin/access'

async function requireAdmin() {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return { user: null, error: 'Forbidden' }
  return { user: auth.user, error: null }
}

// POST /api/campaigns/[id]/send — manually trigger a campaign send
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { user, error } = await requireAdmin()
  if (!user) return NextResponse.json({ error }, { status: 403 })

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
