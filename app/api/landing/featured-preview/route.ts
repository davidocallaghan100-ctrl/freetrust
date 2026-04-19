import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/landing/featured-preview
// Returns up to 8 top-rated listings (quality_score >= 60) for the landing page.
export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('listings')
      .select(`
        id,
        title,
        product_type,
        price,
        currency,
        cover_image,
        images,
        quality_score,
        avg_rating,
        review_count,
        category,
        delivery_days,
        profiles!seller_id (
          full_name,
          avatar_url,
          avg_rating,
          trust_balance
        )
      `)
      .eq('status', 'active')
      .gte('quality_score', 60)
      .order('quality_score', { ascending: false })
      .limit(8)

    if (error) {
      console.error('[landing/featured-preview]', error)
      return NextResponse.json([], { status: 200 })
    }

    type ProfileRow = { full_name: string | null; avatar_url: string | null; avg_rating: number | null; trust_balance: number | null }
    type RawRow = {
      id: string
      title: string
      product_type: string | null
      price: number | null
      currency: string | null
      cover_image: string | null
      images: string[] | null
      quality_score: number | null
      avg_rating: number | null
      review_count: number | null
      category: string | null
      delivery_days: number | null
      profiles: ProfileRow | ProfileRow[] | null
    }

    const rows = (data ?? []) as RawRow[]

    const result = rows.map(r => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const imageUrl = r.cover_image ?? (r.images && r.images.length > 0 ? r.images[0] : null)
      return {
        id: r.id,
        title: r.title,
        type: r.product_type === 'service' ? 'service' : 'product',
        price: r.price ?? 0,
        currency: r.currency ?? 'EUR',
        image_url: imageUrl,
        quality_score: r.quality_score ?? 0,
        seller_name: profile?.full_name ?? 'FreeTrust Member',
        seller_avatar: profile?.avatar_url ?? null,
        avg_rating: r.avg_rating ?? 0,
        review_count: r.review_count ?? 0,
        category: r.category ?? null,
        delivery_days: r.delivery_days ?? null,
      }
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[landing/featured-preview] unexpected error:', err)
    return NextResponse.json([], { status: 200 })
  }
}
