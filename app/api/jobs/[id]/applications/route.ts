export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: jobId } = params

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, title, poster_id')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.poster_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the job poster can view applications' },
        { status: 403 },
      )
    }

    const { data: applications, error: appError } = await supabase
      .from('job_applications')
      .select('id, cover_letter, cv_url, portfolio_url, status, created_at, applicant:profiles!applicant_id(id, full_name, avatar_url, trust_balance)')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (appError) {
      console.error('[GET /api/jobs/[id]/applications]', appError)
      return NextResponse.json({ error: appError.message }, { status: 500 })
    }

    return NextResponse.json({
      applications: applications ?? [],
      jobTitle: job.title,
    })
  } catch (err) {
    console.error('[GET /api/jobs/[id]/applications] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
