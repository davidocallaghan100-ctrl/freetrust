export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executeCampaignSend } from '@/lib/campaigns/send'

// GET /api/cron/campaigns
// Invoked by Vercel Cron every 15 minutes (see vercel.json).
// Finds campaigns with status='scheduled' and scheduled_at <= now(),
// then triggers each one.
//
// Auth: Vercel Cron invocations include Authorization: Bearer <CRON_SECRET>
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()

    // Find campaigns due to send
    const { data: dueCampaigns, error: dbErr } = await admin
      .from('campaigns')
      .select('id, name, scheduled_at')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(10) // process max 10 per cron tick to avoid timeout

    if (dbErr) {
      console.error('[cron/campaigns] query error:', dbErr)
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    if (!dueCampaigns || dueCampaigns.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No campaigns due' })
    }

    const results: { id: string; name: string; result?: object; error?: string }[] = []

    // Process campaigns sequentially (cron budget is limited)
    for (const campaign of dueCampaigns) {
      try {
        console.log(`[cron/campaigns] triggering: ${campaign.id} "${campaign.name}"`)
        const result = await executeCampaignSend(campaign.id as string)
        results.push({ id: campaign.id as string, name: campaign.name as string, result })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[cron/campaigns] failed for ${campaign.id}:`, message)

        // Mark failed
        await admin
          .from('campaigns')
          .update({ status: 'failed' })
          .eq('id', campaign.id)
          .eq('status', 'sending')

        results.push({ id: campaign.id as string, name: campaign.name as string, error: message })
      }
    }

    return NextResponse.json({ processed: results.length, results })
  } catch (err) {
    console.error('[cron/campaigns] unhandled:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
