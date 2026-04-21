export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { insertNotification } from '@/lib/notifications/insert'

// GET /api/jobs/[id]/apply — get job detail + user's application status
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Get job with poster profile
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*, poster:profiles!poster_id(id, full_name, bio, created_at)')
      .eq('id', id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if current user has applied
    let userApplication = null
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: app } = await supabase
        .from('job_applications')
        .select('id, status, created_at')
        .eq('job_id', id)
        .eq('applicant_id', user.id)
        .single()
      userApplication = app
    }

    return NextResponse.json({ job, userApplication })
  } catch (err) {
    console.error('[GET /api/jobs/[id]/apply] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/jobs/[id]/apply — apply for a job (auth required)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: jobId } = params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check job exists and is active
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, status, poster_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.status !== 'active') {
      return NextResponse.json({ error: 'This job is no longer accepting applications' }, { status: 400 })
    }
    if (job.poster_id === user.id) {
      return NextResponse.json({ error: 'You cannot apply to your own job' }, { status: 400 })
    }

    // Check not already applied
    const { data: existing } = await supabase
      .from('job_applications')
      .select('id')
      .eq('job_id', jobId)
      .eq('applicant_id', user.id)
      .single()

    if (existing) {
      return NextResponse.json({ error: 'You have already applied for this job' }, { status: 409 })
    }

    const body = await request.json()
    const { cover_letter, cv_url, portfolio_url } = body

    if (!cover_letter?.trim()) {
      return NextResponse.json({ error: 'Cover letter is required' }, { status: 400 })
    }

    // Insert application (DB trigger will award ₮5 trust)
    const { data: application, error: appError } = await supabase
      .from('job_applications')
      .insert({
        job_id:        jobId,
        applicant_id:  user.id,
        cover_letter:  cover_letter.trim(),
        cv_url:        cv_url?.trim() ?? null,
        portfolio_url: portfolio_url?.trim() ?? null,
        status:        'pending',
      })
      .select()
      .single()

    if (appError) {
      console.error('[POST /api/jobs/[id]/apply]', appError)
      return NextResponse.json({ error: appError.message }, { status: 500 })
    }

    // Increment applicant_count on job
    try {
      await supabase
        .from('jobs')
        .update({ applicant_count: ((job as { applicant_count?: number }).applicant_count ?? 0) + 1 })
        .eq('id', jobId)
    } catch {
      // non-critical, ignore
    }

    // Also try issuing trust directly as a backup (DB trigger is primary)
    try {
      await supabase.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount:  5,
        p_type:    'job_application',
        p_ref:     jobId,
        p_desc:    `Applied for: ${job.title}`,
      })
    } catch {
      // DB trigger handles this — API call is belt-and-suspenders
    }

    // Notify the job poster by email (preference-checked, fire-and-forget)
    const { data: applicant } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
    const applicantName = applicant?.full_name ?? 'A member'
    sendEmail({
      type: 'new_job_application',
      userId: job.poster_id,
      payload: { applicantName, jobTitle: job.title, jobId },
    }).catch(() => {})

    // Fire-and-forget: don't block the response on notification insert
    void insertNotification({
      userId: job.poster_id,
      type: 'job_application',
      title: `New application: ${job.title}`,
      body: `${applicantName} has applied to your job.`,
      link: `/jobs/${jobId}/applications`,
    }).catch(e => console.error('[jobs/apply] notification failed:', e))

    return NextResponse.json({ application, trust_earned: 5 }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/jobs/[id]/apply] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
