export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SearchHit {
  id: string
  type: 'member' | 'service' | 'product' | 'event' | 'article' | 'org' | 'grassroots'
  title: string
  subtitle?: string
  url: string
  // Optional avatar for member hits — used by the /messages New
  // Message dropdown to render a recognisable member list. All
  // non-member hits omit this field.
  avatarUrl?: string | null
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim()
    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10)
    const limit = Math.min(isNaN(limitParam) ? 20 : limitParam, 50)
    const browseMode = !q  // empty query = browse all

    const perType = Math.max(3, Math.floor(limit / 5))

    // Build a tsquery from the user's search term.
    // Convert to prefix-match so partial words work (e.g. "plumb" → "plumb:*").
    // Fall back to ilike when the query is too short for a meaningful tsquery.
    const tsq = q.length >= 2
      ? q.trim().split(/\s+/).map(w => `${w}:*`).join(' & ')
      : null

    // Parallel queries across all tables
    const [membersRes, servicesRes, productsRes, eventsRes, articlesRes, orgsRes, grassrootsRes] = await Promise.allSettled([
      (() => {
        let qb = supabase.from('profiles').select('id, full_name, location, avatar_url').limit(browseMode ? 12 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),

      // Services and products both live in the `listings` table,
      // distinguished by product_type. Same canonical pattern used by
      // app/services/page.tsx, app/services/[id]/page.tsx and
      // app/api/admin/content/route.ts. There is no separate
      // `services` or `products` table in this app.
      (() => {
        let qb = supabase.from('listings').select('id, title, category')
          .eq('product_type', 'service')
          .eq('status', 'active')
          .limit(browseMode ? 12 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),

      (() => {
        let qb = supabase.from('listings').select('id, title, category')
          .neq('product_type', 'service')
          .eq('status', 'active')
          .limit(browseMode ? 12 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),

      (() => {
        let qb = supabase.from('events').select('id, title, starts_at, category').eq('status', 'published').gte('starts_at', new Date().toISOString()).limit(browseMode ? 8 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),

      (() => {
        let qb = supabase.from('articles').select('id, title, slug').limit(browseMode ? 8 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),

      (() => {
        let qb = supabase.from('organisations').select('id, name, category, location').limit(browseMode ? 10 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),

      // Grassroots — listings with product_type='grassroots' in the main listings table
      // (there is no separate grassroots_listings table — grassroots items share the
      //  listings table filtered by product_type)
      (() => {
        let qb = supabase.from('listings')
          .select('id, title, category, location')
          .eq('product_type', 'grassroots')
          .eq('status', 'active')
          .limit(browseMode ? 10 : perType)
        if (tsq) {
          qb = qb.textSearch('search_vector', tsq, { type: 'websearch', config: 'english' })
        }
        return qb
      })(),
    ])

    const hits: SearchHit[] = []

    // Members
    if (membersRes.status === 'fulfilled' && membersRes.value.data) {
      for (const m of membersRes.value.data) {
        hits.push({
          id:        m.id,
          type:      'member',
          title:     m.full_name ?? 'Member',
          subtitle:  m.location || undefined,
          url:       `/profile?id=${m.id}`,
          avatarUrl: (m.avatar_url as string | null | undefined) ?? null,
        })
      }
    }

    // Services
    if (servicesRes.status === 'fulfilled' && servicesRes.value.data) {
      for (const s of servicesRes.value.data) {
        hits.push({
          id: s.id,
          type: 'service',
          title: s.title,
          subtitle: s.category ?? undefined,
          url: `/services/${s.id}`,
        })
      }
    }

    // Products
    if (productsRes.status === 'fulfilled' && productsRes.value.data) {
      for (const p of productsRes.value.data) {
        hits.push({
          id: p.id,
          type: 'product',
          title: p.title,
          subtitle: p.category ?? undefined,
          url: `/products/${p.id}`,
        })
      }
    }

    // Events
    if (eventsRes.status === 'fulfilled' && eventsRes.value.data) {
      for (const e of eventsRes.value.data) {
        const dateStr = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : undefined
        hits.push({
          id: e.id,
          type: 'event',
          title: e.title,
          subtitle: [dateStr, e.category].filter(Boolean).join(' · ') || undefined,
          url: `/events/${e.id}`,
        })
      }
    }

    // Articles
    if (articlesRes.status === 'fulfilled' && articlesRes.value.data) {
      for (const a of articlesRes.value.data) {
        hits.push({
          id: a.id,
          type: 'article',
          title: a.title,
          url: `/articles/${a.slug ?? a.id}`,
        })
      }
    }

    // Organisations
    if (orgsRes.status === 'fulfilled' && orgsRes.value.data) {
      for (const o of orgsRes.value.data) {
        hits.push({
          id: o.id,
          type: 'org',
          title: o.name,
          subtitle: [o.category, o.location].filter(Boolean).join(' · ') || undefined,
          url: `/organisations/${o.id}`,
        })
      }
    }

    // Grassroots listings — typed as 'grassroots' so the SearchBar UI
    // can render the 🌱 icon + "Grassroots" group label.
    if (grassrootsRes.status === 'fulfilled' && grassrootsRes.value.data) {
      for (const g of grassrootsRes.value.data) {
        hits.push({
          id: g.id,
          type: 'grassroots',
          title: g.title,
          subtitle: [g.category, g.location].filter(Boolean).join(' · ') || undefined,
          url: `/grassroots/${g.id}`,
        })
      }
    }

    return NextResponse.json(
      { hits, total: hits.length, query: q },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[GET /api/search]', err)
    return NextResponse.json({ hits: [], total: 0, query: '' }, { status: 500 })
  }
}
