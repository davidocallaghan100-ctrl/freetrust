export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { insertNotification } from '@/lib/notifications/insert'

const VALID_STATUSES = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired']

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; appId: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId, appId } = params
    const admin = createAdminClient()

    // Verify caller is the job poster
    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select('id, title, poster_id')
      .eq('id', jobId)
      .maybeSingle()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.poster_id !== user.id) {
      return NextResponse.json({ error: 'Only the job poster can update applications' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as { status?: string }
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 },
      )
    }

    // Fetch the application to get applicant_id
    const { data: app, error: appErr } = await admin
      .from('job_applications')
      .select('id, applicant_id, status')
      .eq('id', appId)
      .eq('job_id', jobId)
      .maybeSingle()

    if (appErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Update status
    const { data: updated, error: updateErr } = await admin
      .from('job_applications')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', appId)
      .select()
      .single()

    if (updateErr) {
      console.error('[PATCH /api/jobs/[id]/applications/[appId]]', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Notify applicant on shortlist or rejection — fire-and-forget
    if (status === 'shortlisted' || status === 'rejected') {
      void insertNotification({
        userId: app.applicant_id,
        type: 'job_application',
        title: status === 'shortlisted'
          ? `🎉 You've been shortlisted for: ${job.title}`
          : `Update on your application for: ${job.title}`,
        body: status === 'shortlisted'
          ? 'Congratulations! The employer has shortlisted your application.'
          : 'The employer has reviewed your application and decided to move forward with other candidates.',
        link: `/jobs/${jobId}`,
      }).catch(e => console.error('[applications/[appId]] notification failed:', e))
    }

    return NextResponse.json({ application: updated })
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]/applications/[appId]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
