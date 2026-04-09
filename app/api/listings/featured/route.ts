import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GRADS = [
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]

function gradForTitle(title: string): string {
  const idx = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length
  return GRADS[idx]
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('listings')
      .select('id, title, price, currency, avg_rating, review_count, seller:profiles!seller_id(full_name, avatar_url)')
      .eq('product_type', 'service')
      .eq('status', 'active')
      .order('review_count', { ascending: false })
      .limit(6)

    if (error || !data) {
      return NextResponse.json([], { status: 200 })
    }

    const result = data.map((s: Record<string, unknown>) => {
      const seller = s.seller as { full_name?: string | null; avatar_url?: string | null } | null
      return {
        id: s.id,
        title: s.title,
        price: s.price,
        currency: (s.currency as string) || 'GBP',
        rating: Number(s.avg_rating ?? 0),
        reviews: Number(s.review_count ?? 0),
        provider: seller?.full_name ?? 'FreeTrust Member',
        avatarUrl: seller?.avatar_url ?? null,
        grad: gradForTitle(String(s.title)),
        tags: [],
      }
    })

    return NextResponse.json(result)
  } catch {
    return NextResponse.json([], { status: 200 })
  }
}
