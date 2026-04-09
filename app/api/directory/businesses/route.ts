import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('businesses')
      .select('id, name, slug, business_type, industry, description, logo_url, location, verified, follower_count, trust_score')
      .eq('status', 'active')
      .order('trust_score', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[GET /api/directory/businesses]', error)
      return NextResponse.json({ businesses: [] })
    }

    const businesses = (data ?? []).map(b => ({
      id: b.id,
      type: 'business' as const,
      name: b.name ?? 'Unknown',
      slug: b.slug ?? null,
      business_type: b.business_type ?? null,
      industry: b.industry ?? null,
      description: b.description ?? null,
      logo_url: b.logo_url ?? null,
      location: b.location ?? null,
      verified: b.verified ?? false,
      follower_count: b.follower_count ?? null,
      trust_score: b.trust_score ?? null,
    }))

    return NextResponse.json({ businesses })
  } catch (err) {
    console.error('[GET /api/directory/businesses] unexpected error:', err)
    return NextResponse.json({ businesses: [] })
  }
}
