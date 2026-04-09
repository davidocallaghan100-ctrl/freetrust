import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('organisations')
      .select('id, name, logo_url, description, category, location, verified, follower_count, services')
      .order('follower_count', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/directory/orgs]', error)
      return NextResponse.json({ orgs: [] })
    }

    const orgs = (data ?? []).map(o => ({
      id: o.id,
      type: 'organisation' as const,
      name: o.name ?? 'Unknown',
      logo_url: o.logo_url ?? null,
      description: o.description ?? null,
      category: o.category ?? null,
      location: o.location ?? null,
      verified: o.verified ?? false,
      follower_count: o.follower_count ?? null,
      services: Array.isArray(o.services) ? o.services : [],
    }))

    return NextResponse.json({ orgs })
  } catch (err) {
    console.error('[GET /api/directory/orgs] unexpected error:', err)
    return NextResponse.json({ orgs: [] })
  }
}
