export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { getSequenceForIcp, getNextEmail, interpolate } from '@/lib/outbound/sequences'

// GET /api/cron/outbound-sequence
// Runs hourly. Sends the correct sequence email to any lead that is due.
// sequence_step tracks how many emails have been sent (0 = none, 1 = email1, 2 = email2, 3 = email3).
// Respects CRON_SECRET for production auth.

const FROM = process.env.RESEND_DKIM_VERIFIED === 'true'
  ? 'FreeTrust <hello@freetrust.co>'
  : 'FreeTrust <onboarding@resend.dev>'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const admin = createAdminClient()
  const now = new Date()

  // Find all leads that are enrolled and haven't finished the sequence
  const { data: leads, error: leadsError } = await admin
    .from('outbound_leads')
    .select('id, email, first_name, business_name, icp_category, sequence_step, enrolled_at, status')
    .eq('status', 'enrolled')
    .lt('sequence_step', 3)
    .not('email', 'is', null)

  if (leadsError) {
    console.error('[cron/outbound-sequence] leads query error:', leadsError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  let sent = 0
  let skipped = 0
  let errors = 0

  for (const lead of leads ?? []) {
    try {
      const sequence = getSequenceForIcp(lead.icp_category ?? '')
      if (!sequence) { skipped++; continue }

      const result = getNextEmail(sequence, lead.sequence_step ?? 0, new Date(lead.enrolled_at ?? now))
      if (!result) { skipped++; continue }

      const { email: emailTemplate, stepIndex } = result

      // Interpolate variables
      const firstName = (lead.first_name as string | null) ?? 'there'
      const businessName = (lead.business_name as string | null) ?? ''
      const vars = { first_name: firstName, business_name: businessName }

      const subject = interpolate(emailTemplate.subject, vars)
      const html = interpolate(emailTemplate.body_html, vars)
      const text = interpolate(emailTemplate.body_text, vars)

      // Send email (non-blocking, never crash)
      const sendResult = await resend.emails.send({
        from: FROM,
        to: lead.email as string,
        subject,
        html,
        text,
      })

      if (sendResult.error) {
        console.error(`[cron/outbound-sequence] Resend error for ${lead.email}:`, sendResult.error)
        errors++
        continue
      }

      // Update sequence step and last_sent_at
      const newStep = stepIndex + 1
      const newStatus = newStep >= 3 ? 'contacted' : 'enrolled'

      await admin
        .from('outbound_leads')
        .update({
          sequence_step: newStep,
          last_sent_at: now.toISOString(),
          status: newStatus,
        })
        .eq('id', lead.id)

      sent++
    } catch (err) {
      console.error(`[cron/outbound-sequence] Error for lead ${lead.id}:`, err)
      errors++
    }
  }

  console.log(`[cron/outbound-sequence] sent=${sent} skipped=${skipped} errors=${errors}`)

  return NextResponse.json({
    sent,
    skipped,
    errors,
    total_processed: (leads ?? []).length,
    timestamp: now.toISOString(),
  })
}
