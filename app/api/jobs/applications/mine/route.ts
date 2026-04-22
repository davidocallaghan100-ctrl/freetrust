export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/jobs/applications/mine
// Returns all job_applications where applicant_id = current user
// Joined with jobs table for title, company info, job_type, location_type, poster_id
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: applications, error } = await admin
      .from('job_applications')
      .select(`
        id,
        status,
        cover_letter,
        cv_url,
        portfolio_url,
        created_at,
        job:jobs(
          id,
          title,
          company_name,
          company_logo_url,
          job_type,
          location_type,
          location,
          poster_id,
          org_id,
          status
        )
      `)
      .eq('applicant_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[GET /api/jobs/applications/mine]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const apps = applications ?? []

    // Compute stats
    const stats = {
      total:       apps.length,
      pending:     apps.filter(a => a.status === 'pending').length,
      reviewed:    apps.filter(a => a.status === 'reviewed').length,
      shortlisted: apps.filter(a => a.status === 'shortlisted').length,
      hired:       apps.filter(a => a.status === 'hired').length,
      rejected:    apps.filter(a => a.status === 'rejected').length,
    }

    return NextResponse.json({ applications: apps, stats })
  } catch (err) {
    console.error('[GET /api/jobs/applications/mine] Unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
