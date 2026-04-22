export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_STATUS = ['active', 'paused', 'closed', 'filled', 'draft']
const VALID_JOB_TYPE = ['full_time', 'part_time', 'contract', 'freelance', 'internship']
const VALID_LOCATION_TYPE = ['remote', 'hybrid', 'on_site']

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const admin = createAdminClient()

    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select('id, poster_id')
      .eq('id', id)
      .maybeSingle()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.poster_id !== user.id) {
      return NextResponse.json({ error: 'Only the job poster can edit this job' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>

    const updates: Record<string, unknown> = {}

    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title.trim()
    if (typeof body.description === 'string' && body.description.trim()) updates.description = body.description.trim()
    if (typeof body.requirements === 'string') updates.requirements = body.requirements.trim() || null
    if (typeof body.job_type === 'string' && VALID_JOB_TYPE.includes(body.job_type)) updates.job_type = body.job_type
    if (typeof body.location_type === 'string' && VALID_LOCATION_TYPE.includes(body.location_type)) updates.location_type = body.location_type
    if (typeof body.location === 'string') updates.location = body.location.trim() || null
    if (typeof body.salary_min === 'number' || body.salary_min === null) updates.salary_min = body.salary_min
    if (typeof body.salary_max === 'number' || body.salary_max === null) updates.salary_max = body.salary_max
    if (typeof body.salary_currency === 'string') updates.salary_currency = body.salary_currency
    if (typeof body.category === 'string' && body.category.trim()) updates.category = body.category.trim()
    if (Array.isArray(body.tags)) updates.tags = body.tags.filter((t: unknown): t is string => typeof t === 'string')
    if (typeof body.status === 'string' && VALID_STATUS.includes(body.status)) updates.status = body.status
    // Logo / company fields
    if (typeof body.company_logo_url === 'string') updates.company_logo_url = body.company_logo_url || null
    if (typeof body.company_name === 'string') updates.company_name = body.company_name.trim() || null
    if (typeof body.company_website === 'string') updates.company_website = body.company_website.trim() || null

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data: updated, error: updateErr } = await admin
      .from('jobs')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) {
      console.error('[PATCH /api/jobs/[id]]', updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ job: updated })
  } catch (err) {
    console.error('[PATCH /api/jobs/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const admin = createAdminClient()

    const { data: job, error: jobErr } = await admin
      .from('jobs')
      .select('id, poster_id')
      .eq('id', id)
      .maybeSingle()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }
    if (job.poster_id !== user.id) {
      return NextResponse.json({ error: 'Only the job poster can delete this job' }, { status: 403 })
    }

    // Delete applications first to avoid FK violations
    await admin.from('job_applications').delete().eq('job_id', id)

    const { error: deleteErr } = await admin.from('jobs').delete().eq('id', id)
    if (deleteErr) {
      console.error('[DELETE /api/jobs/[id]]', deleteErr)
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ deleted: true })
  } catch (err) {
    console.error('[DELETE /api/jobs/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
