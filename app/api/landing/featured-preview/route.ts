import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/landing/featured-preview
// Returns up to 8 recent active rent_share_listings for the landing page Rent & Share section.
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('rent_share_listings')
      .select(`
        id,
        title,
        category,
        price_per_day,
        price_per_week,
        deposit,
        location,
        images,
        available_from,
        available_to,
        created_at,
        profiles:user_id (
          full_name,
          avatar_url
        )
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(8)

    if (error) {
      console.error('[landing/featured-preview]', error)
      return NextResponse.json([], { status: 200 })
    }

    type ProfileRow = { full_name: string | null; avatar_url: string | null }
    type RawRow = {
      id: string
      title: string
      category: string | null
      price_per_day: number | null
      price_per_week: number | null
      deposit: number | null
      location: string | null
      images: string[] | null
      available_from: string | null
      available_to: string | null
      created_at: string
      profiles: ProfileRow | ProfileRow[] | null
    }

    const rows = (data ?? []) as RawRow[]

    const result = rows.map(r => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const imageUrl = r.images && r.images.length > 0 ? r.images[0] : null
      return {
        id: r.id,
        title: r.title,
        category: r.category ?? 'Other',
        price_per_day: r.price_per_day ?? null,
        price_per_week: r.price_per_week ?? null,
        deposit: r.deposit ?? null,
        location: r.location ?? null,
        image_url: imageUrl,
        available_from: r.available_from ?? null,
        available_to: r.available_to ?? null,
        created_at: r.created_at,
        owner_name: profile?.full_name ?? 'FreeTrust Member',
        owner_avatar: profile?.avatar_url ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[landing/featured-preview] unexpected error:', err)
    return NextResponse.json([], { status: 200 })
  }
}
