export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // Only return real (active) organisations — rows without status='active' are
    // placeholder/seed data inserted before the status column was introduced.
    const { data, error } = await supabase
      .from('organisations')
      .select('id, name, logo_url, description, type, location, is_verified, members_count, tags')
      .eq('status', 'active')
      .order('members_count', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/directory/orgs]', error)
      return NextResponse.json({ orgs: [] })
    }

    const orgs = (data ?? []).map((o: {
      id: string; name: string | null; logo_url: string | null; description: string | null
      type: string | null; location: string | null; is_verified: boolean | null
      members_count: number | null; tags: string[] | null
    }) => ({
      id: o.id,
      type: 'organisation' as const,
      name: o.name ?? 'Unknown',
      logo_url: o.logo_url ?? null,
      description: o.description ?? null,
      category: o.type ?? null,
      location: o.location ?? null,
      verified: o.is_verified ?? false,
      follower_count: o.members_count ?? 0,
      services: Array.isArray(o.tags) ? o.tags : [],
    }))

    return NextResponse.json({ orgs }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (err) {
    console.error('[GET /api/directory/orgs] unexpected error:', err)
    return NextResponse.json({ orgs: [] })
  }
}
