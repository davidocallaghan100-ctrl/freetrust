import { createClient } from '@/lib/supabase/server'
import type { SearchParams, SearchResponse, SearchResult } from './types'

// Demo fallback results for when DB tables don't have data yet
const DEMO_RESULTS: SearchResult[] = [
  { id: 's1', title: 'Web Development', subtitle: 'Full-stack development service', description: 'Professional web development for startups and SMEs. React, Next.js, Node.js.', href: '/services/web-development', category: 'service', location: 'London, UK', price: 500, trustScore: 92 },
  { id: 's2', title: 'Logo Design', subtitle: 'Brand identity design', description: 'Custom logo and brand identity packages tailored to your business.', href: '/services/logo-design', category: 'service', location: 'Remote', price: 150, trustScore: 88 },
  { id: 'p1', title: 'FreeTrust Pro Plan', subtitle: 'Premium subscription', description: 'Unlock advanced features including verified badges, analytics, and priority support.', href: '/products/pro-plan', category: 'product', price: 29, trustScore: 95 },
  { id: 'e1', title: 'Freelancer Meetup', subtitle: 'Networking event', description: 'Monthly meetup for freelancers and independent professionals.', href: '/events/freelancer-meetup', category: 'event', location: 'London, UK', date: 'Apr 18, 2026', trustScore: 78 },
  { id: 'o1', title: 'Tech Guild', subtitle: 'Professional organisation', description: "A community for tech professionals, freelancers, and founders.", href: '/organisations/tech-guild', category: 'organisation', location: 'Global', trustScore: 85 },
  { id: 'm1', title: 'David O Callaghan', subtitle: 'Founder & Developer', description: 'Building FreeTrust — open-source trust infrastructure for modern applications.', href: '/members/davidocallaghan', category: 'member', location: 'Global', trustScore: 91 },
]

export async function fetchSearchResults({
  query,
  category = 'all',
  location,
  priceMin,
  priceMax,
  trustScore = 0,
  page = 1,
  pageSize = 12,
}: SearchParams): Promise<SearchResponse> {
  const supabase = await createClient()
  const q = query?.trim() ?? ''
  const pattern = `%${q}%`
  const allResults: SearchResult[] = []

  try {
    // Services + Products from listings
    if (category === 'all' || category === 'service' || category === 'product') {
      let listingsQuery = supabase
        .from('listings')
        .select('id, title, description, price, currency, images, seller_id, tags, status')
        .eq('status', 'active')

      if (q) listingsQuery = listingsQuery.or(`title.ilike.${pattern},description.ilike.${pattern}`)
      if (priceMin !== undefined) listingsQuery = listingsQuery.gte('price', priceMin)
      if (priceMax !== undefined) listingsQuery = listingsQuery.lte('price', priceMax)
      listingsQuery = listingsQuery.limit(10)

      const { data: listings } = await listingsQuery
      if (listings) {
        for (const item of listings) {
          const isProduct = (item.tags as string[])?.includes('product')
          const cat = isProduct ? 'product' : 'service'
          if (category !== 'all' && category !== cat) continue
          allResults.push({
            id: item.id,
            title: item.title,
            description: item.description?.slice(0, 120),
            href: `/${cat}s/${item.id}`,
            category: cat,
            price: item.price ? Number(item.price) : undefined,
            thumbnail: (item.images as string[])?.[0],
          })
        }
      }
    }

    // Events
    if (category === 'all' || category === 'event') {
      let eventsQuery = supabase
        .from('events')
        .select('id, title, description, start_date, location, cover_url, attendee_count')
      if (q) eventsQuery = eventsQuery.or(`title.ilike.${pattern},description.ilike.${pattern}`)
      if (location) eventsQuery = eventsQuery.ilike('location', `%${location}%`)
      eventsQuery = eventsQuery.limit(5)

      const { data: events } = await eventsQuery
      if (events) {
        for (const e of events) {
          allResults.push({
            id: e.id,
            title: e.title,
            description: e.description?.slice(0, 120),
            href: `/events/${e.id}`,
            category: 'event',
            location: e.location,
            date: e.start_date ? new Date(e.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
            thumbnail: e.cover_url,
          })
        }
      }
    }

    // Articles
    if (category === 'all' || category === 'article') {
      let articlesQuery = supabase
        .from('articles')
        .select('id, title, slug, excerpt, cover_url, published_at')
        .eq('status', 'published')
      if (q) articlesQuery = articlesQuery.ilike('title', pattern)
      articlesQuery = articlesQuery.limit(5)

      const { data: articles } = await articlesQuery
      if (articles) {
        for (const a of articles) {
          allResults.push({
            id: a.id,
            title: a.title,
            description: a.excerpt?.slice(0, 120),
            href: `/articles/${a.slug}`,
            category: 'article',
            thumbnail: a.cover_url,
            date: a.published_at ? new Date(a.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined,
          })
        }
      }
    }

    // Members
    if (category === 'all' || category === 'member') {
      let membersQuery = supabase
        .from('profiles')
        .select('id, full_name, bio, location, avatar_url, role')
      if (q) membersQuery = membersQuery.ilike('full_name', pattern)
      if (location) membersQuery = membersQuery.ilike('location', `%${location}%`)
      membersQuery = membersQuery.limit(5)

      const { data: members } = await membersQuery
      if (members) {
        for (const m of members) {
          allResults.push({
            id: m.id,
            title: m.full_name ?? 'Anonymous',
            subtitle: m.role,
            description: m.bio?.slice(0, 100),
            href: `/profile?id=${m.id}`,
            category: 'member',
            location: m.location,
            thumbnail: m.avatar_url,
          })
        }
      }
    }

    // Organisations
    if (category === 'all' || category === 'organisation') {
      let orgsQuery = supabase
        .from('organisations')
        .select('id, name, slug, description, type, location, logo_url, member_count, verified')
      if (q) orgsQuery = orgsQuery.or(`name.ilike.${pattern},description.ilike.${pattern}`)
      if (location) orgsQuery = orgsQuery.ilike('location', `%${location}%`)
      orgsQuery = orgsQuery.limit(5)

      const { data: orgs } = await orgsQuery
      if (orgs) {
        for (const o of orgs) {
          allResults.push({
            id: o.id,
            title: o.name,
            subtitle: o.type,
            description: o.description?.slice(0, 120),
            href: `/organisation/${o.id}`,
            category: 'organisation',
            location: o.location,
            thumbnail: o.logo_url,
          })
        }
      }
    }
  } catch {
    // Supabase query failed; fall through to demo fallback
  }

  // If no real results, use demo fallback so the page isn't empty
  const sourceResults = allResults.length > 0 ? allResults : DEMO_RESULTS

  const qLower = q.toLowerCase()
  let filtered = sourceResults.filter((r) => {
    if (qLower && !r.title.toLowerCase().includes(qLower) && !r.description?.toLowerCase().includes(qLower)) return false
    if (category && category !== 'all' && r.category !== category) return false
    if (location && !r.location?.toLowerCase().includes(location.toLowerCase())) return false
    if (priceMin !== undefined && (r.price ?? 0) < priceMin) return false
    if (priceMax !== undefined && (r.price ?? Infinity) > priceMax) return false
    if (trustScore > 0 && (r.trustScore ?? 0) < trustScore) return false
    return true
  })

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const results = filtered.slice(start, start + pageSize)

  return { results, total, totalPages }
}
