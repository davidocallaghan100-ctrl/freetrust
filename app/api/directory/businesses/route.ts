export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    // No separate 'businesses' table — use organisations table with business-type entries.
    // Only return rows with status='active' to exclude placeholder/seed data.
    const { data, error } = await supabase
      .from('organisations')
      .select('id, name, slug, type, sector, description, logo_url, location, is_verified, members_count, trust_score, tags')
      .eq('status', 'active')
      .order('trust_score', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/directory/businesses]', error)
      return NextResponse.json({ businesses: [] })
    }

    const businesses = (data ?? []).map((b: {
      id: string; name: string | null; slug: string | null; type: string | null
      sector: string | null; description: string | null; logo_url: string | null
      location: string | null; is_verified: boolean | null; members_count: number | null
      trust_score: number | null; tags: string[] | null
    }) => ({
      id: b.id,
      type: 'business' as const,
      name: b.name ?? 'Unknown',
      slug: b.slug ?? null,
      business_type: b.type ?? null,
      industry: b.sector ?? null,
      description: b.description ?? null,
      logo_url: b.logo_url ?? null,
      location: b.location ?? null,
      verified: b.is_verified ?? false,
      follower_count: b.members_count ?? 0,
      trust_score: b.trust_score ?? null,
    }))

    return NextResponse.json({ businesses }, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    })
  } catch (err) {
    console.error('[GET /api/directory/businesses] unexpected error:', err)
    return NextResponse.json({ businesses: [] })
  }
}
