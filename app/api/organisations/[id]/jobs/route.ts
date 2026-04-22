export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/organisations/[id]/jobs
 * Returns all jobs posted on behalf of this organisation.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient()

    // Resolve org id or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let orgId = id
    if (!isUUID) {
      const { data: org } = await admin
        .from('organisations')
        .select('id')
        .eq('slug', id)
        .maybeSingle()
      if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
      orgId = org.id
    }

    const { data: jobs, error } = await admin
      .from('jobs')
      .select('id, title, job_type, location_type, location, category, status, created_at, applicant_count, company_logo_url, poster:profiles!poster_id(id, full_name, avatar_url)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/organisations/[id]/jobs]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: jobs ?? [] })
  } catch (err) {
    console.error('[GET /api/organisations/[id]/jobs] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
