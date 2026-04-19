import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/landing/jobs-preview?limit=4
// Returns the N most recently posted active local jobs for the landing page strip.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '4'), 8)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('jobs')
      .select('id, title, job_type, location_type, location, city, salary_min, salary_max, salary_currency, created_at, poster:profiles!poster_id(full_name)')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[landing/jobs-preview]', error)
      return NextResponse.json([], { status: 200 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('[landing/jobs-preview] unexpected error:', err)
    return NextResponse.json([], { status: 200 })
  }
}
