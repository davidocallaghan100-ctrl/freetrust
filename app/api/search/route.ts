import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() ?? ''
    const type = searchParams.get('type') ?? 'all'

    const supabase = await createClient()

    const results: {
      services: unknown[]
      products: unknown[]
      events: unknown[]
      articles: unknown[]
      members: unknown[]
      organisations: unknown[]
    } = {
      services: [],
      products: [],
      events: [],
      articles: [],
      members: [],
      organisations: [],
    }

    const pattern = `%${q}%`

    // Services
    if (type === 'all' || type === 'services') {
      const { data } = await supabase
        .from('listings')
        .select('id, title, description, price, currency, images, seller_id, tags')
        .eq('status', 'active')
        .ilike('title', pattern)
        .limit(5)
      results.services = data ?? []
    }

    // Products (listings without type differentiation — filter by tags or title)
    if (type === 'all' || type === 'products') {
      const { data } = await supabase
        .from('listings')
        .select('id, title, description, price, currency, images, seller_id, tags')
        .eq('status', 'active')
        .ilike('description', pattern)
        .limit(5)
      results.products = data ?? []
    }

    // Events
    if (type === 'all' || type === 'events') {
      const { data } = await supabase
        .from('events')
        .select('id, title, description, start_date, location, cover_url, organiser_id, attendee_count')
        .ilike('title', pattern)
        .limit(5)
      results.events = data ?? []
    }

    // Articles
    if (type === 'all' || type === 'articles') {
      const { data } = await supabase
        .from('articles')
        .select('id, title, slug, excerpt, author_id, clap_count, read_time_minutes, cover_url, published_at')
        .eq('status', 'published')
        .ilike('title', pattern)
        .limit(5)
      results.articles = data ?? []
    }

    // Members (profiles)
    if (type === 'all' || type === 'members') {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, bio, location, avatar_url, role')
        .ilike('full_name', pattern)
        .limit(5)
      results.members = data ?? []
    }

    // Organisations
    if (type === 'all' || type === 'organisations') {
      const { data } = await supabase
        .from('organisations')
        .select('id, name, slug, description, type, location, logo_url, member_count, verified')
        .ilike('name', pattern)
        .limit(5)
      results.organisations = data ?? []
    }

    const total =
      results.services.length +
      results.products.length +
      results.events.length +
      results.articles.length +
      results.members.length +
      results.organisations.length

    return NextResponse.json({ results, total })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
