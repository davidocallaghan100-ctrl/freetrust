/**
 * Shared campaign send logic.
 * Used by both the manual trigger (POST /api/campaigns/[id]/send)
 * and the scheduled cron (GET /api/cron/campaigns).
 *
 * Sends to the segment in batches of 25 with a 100ms delay between batches.
 * Tracks each individual send in campaign_sends and updates the campaign record.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendCampaignEmail } from '@/lib/resend'

const BATCH_SIZE = 25
const BATCH_DELAY_MS = 100

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface Profile {
  id: string
  email: string
  full_name: string | null
}

// ── Segment queries ────────────────────────────────────────────────────────────

async function getSegmentProfiles(segment: string): Promise<Profile[]> {
  const admin = createAdminClient()

  const base = admin
    .from('profiles')
    .select('id, email, full_name')
    .not('email', 'is', null)

  if (segment === 'all') {
    const { data } = await base.limit(5000)
    return (data ?? []) as Profile[]
  }

  if (segment === 'inactive_7d') {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    // Use updated_at as a proxy for last activity
    const { data } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .not('email', 'is', null)
      .lt('updated_at', cutoff)
      .limit(5000)
    return (data ?? []) as Profile[]
  }

  if (segment === 'inactive_30d') {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .not('email', 'is', null)
      .lt('updated_at', cutoff)
      .limit(5000)
    return (data ?? []) as Profile[]
  }

  if (segment === 'zero_trust') {
    // Profiles with no trust_balances row or balance = 0
    const { data } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .not('email', 'is', null)
      .limit(5000)

    if (!data) return []

    // Filter to those with zero or no trust balance
    const profileIds = data.map((p: Profile) => p.id)
    const { data: balances } = await admin
      .from('trust_balances')
      .select('user_id, balance')
      .in('user_id', profileIds)
      .gt('balance', 0)

    const hasBalance = new Set((balances ?? []).map((b: { user_id: string }) => b.user_id))
    return (data as Profile[]).filter(p => !hasBalance.has(p.id))
  }

  if (segment === 'no_purchase') {
    // Profiles with no completed orders as buyer
    const { data } = await admin
      .from('profiles')
      .select('id, email, full_name')
      .not('email', 'is', null)
      .limit(5000)

    if (!data) return []

    const profileIds = data.map((p: Profile) => p.id)
    const { data: buyers } = await admin
      .from('orders')
      .select('buyer_id')
      .in('buyer_id', profileIds)
      .eq('status', 'completed')

    const hasPurchased = new Set((buyers ?? []).map((o: { buyer_id: string }) => o.buyer_id))
    return (data as Profile[]).filter(p => !hasPurchased.has(p.id))
  }

  // Default: all
  const { data } = await base.limit(5000)
  return (data ?? []) as Profile[]
}

// ── Main send function ─────────────────────────────────────────────────────────

export interface CampaignSendResult {
  totalRecipients: number
  totalSent: number
  totalFailed: number
}

export async function executeCampaignSend(campaignId: string): Promise<CampaignSendResult> {
  const admin = createAdminClient()

  // Fetch campaign
  const { data: campaign, error: campErr } = await admin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle()

  if (campErr || !campaign) {
    throw new Error(`Campaign not found: ${campaignId}`)
  }

  if (campaign.status === 'sending' || campaign.status === 'sent') {
    throw new Error(`Campaign already ${campaign.status}`)
  }

  // Mark as sending
  await admin
    .from('campaigns')
    .update({ status: 'sending' })
    .eq('id', campaignId)

  // Resolve segment
  const profiles = await getSegmentProfiles(campaign.segment as string)
  const totalRecipients = profiles.length

  // Update recipient count
  await admin
    .from('campaigns')
    .update({ total_recipients: totalRecipients })
    .eq('id', campaignId)

  let totalSent = 0
  let totalFailed = 0

  // Send in batches
  for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
    const batch = profiles.slice(i, i + BATCH_SIZE)

    await Promise.all(batch.map(async (profile) => {
      const name = profile.full_name ?? 'there'
      const email = profile.email

      try {
        await sendCampaignEmail(email, name, campaign.subject as string, campaign.body_html as string)

        // Record successful send
        await admin.from('campaign_sends').insert({
          campaign_id: campaignId,
          user_id: profile.id,
          email,
          status: 'sent',
          sent_at: new Date().toISOString(),
        })

        totalSent++
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[campaign] send failed for ${email}:`, errMsg)

        // Record failed send
        await admin.from('campaign_sends').insert({
          campaign_id: campaignId,
          user_id: profile.id,
          email,
          status: 'failed',
          error: errMsg,
        })

        totalFailed++
      }
    }))

    // Update running totals after each batch
    await admin
      .from('campaigns')
      .update({ total_sent: totalSent, total_failed: totalFailed })
      .eq('id', campaignId)

    // Throttle between batches (except the last one)
    if (i + BATCH_SIZE < profiles.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  // Mark as sent
  await admin
    .from('campaigns')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      total_sent: totalSent,
      total_failed: totalFailed,
    })
    .eq('id', campaignId)

  console.log(`[campaign] ${campaignId} sent: ${totalSent}/${totalRecipients}, failed: ${totalFailed}`)
  return { totalRecipients, totalSent, totalFailed }
}
