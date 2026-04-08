import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id } = params

    // Fetch org
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch team members
    const { data: members } = await supabase
      .from('organisation_members')
      .select('*')
      .eq('org_id', id)
      .order('display_order')

    // Fetch reviews
    const { data: reviews } = await supabase
      .from('organisation_reviews')
      .select('*')
      .eq('org_id', id)
      .order('created_at', { ascending: false })

    // Fetch listings (services + products) for this org owner
    const { data: listings } = await supabase
      .from('listings')
      .select('id, title, description, price, currency, images, tags')
      .eq('seller_id', org.owner_id)
      .eq('status', 'active')
      .limit(12)

    const services = (listings ?? []).filter(
      (l: { tags?: string[] }) => !(l.tags as string[])?.includes('product')
    )
    const products = (listings ?? []).filter(
      (l: { tags?: string[] }) => (l.tags as string[])?.includes('product')
    )

    return NextResponse.json({
      org,
      members: members ?? [],
      reviews: reviews ?? [],
      services,
      products,
    })
  } catch (error) {
    console.error('Organisation fetch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
