import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: projects, error } = await supabase
      .from('impact_projects')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })

    if (error) throw error
    return NextResponse.json({ projects: projects ?? [] })
  } catch (err) {
    console.error('[GET /api/impact/projects]', err)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }
}
