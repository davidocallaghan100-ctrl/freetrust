import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface SearchHit {
  id: string
  type: 'member' | 'service' | 'product' | 'event' | 'article' | 'org'
  title: string
  subtitle?: string
  url: string
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim()
    const limitParam = parseInt(searchParams.get('limit') ?? '20', 10)
    const limit = Math.min(isNaN(limitParam) ? 20 : limitParam, 50)

    if (!q) {
      return NextResponse.json({ hits: [], total: 0, query: '' })
    }

    const pattern = `%${q}%`
    const perType = Math.max(3, Math.floor(limit / 5))

    // Parallel queries across all tables
    const [membersRes, servicesRes, productsRes, eventsRes, articlesRes, orgsRes] = await Promise.allSettled([
      supabase
        .from('profiles')
        .select('id, full_name, username, location')
        .or(`full_name.ilike.${pattern},username.ilike.${pattern},bio.ilike.${pattern}`)
        .limit(perType),

      supabase
        .from('services')
        .select('id, title, category')
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .eq('status', 'active')
        .limit(perType),

      supabase
        .from('products')
        .select('id, title, category')
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .eq('status', 'active')
        .limit(perType),

      supabase
        .from('events')
        .select('id, title, starts_at, category')
        .or(`title.ilike.${pattern},description.ilike.${pattern}`)
        .eq('status', 'published')
        .gte('starts_at', new Date().toISOString())
        .limit(perType),

      supabase
        .from('articles')
        .select('id, title, slug')
        .or(`title.ilike.${pattern},content.ilike.${pattern}`)
        .limit(perType),

      supabase
        .from('organisations')
        .select('id, name, category, location')
        .or(`name.ilike.${pattern},description.ilike.${pattern}`)
        .limit(perType),
    ])

    const hits: SearchHit[] = []

    // Members
    if (membersRes.status === 'fulfilled' && membersRes.value.data) {
      for (const m of membersRes.value.data) {
        hits.push({
          id: m.id,
          type: 'member',
          title: m.full_name ?? m.username ?? 'Member',
          subtitle: [m.username ? `@${m.username}` : null, m.location].filter(Boolean).join(' · ') || undefined,
          url: `/profile?id=${m.id}`,
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

    return NextResponse.json(
      { hits, total: hits.length, query: q },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[GET /api/search]', err)
    return NextResponse.json({ hits: [], total: 0, query: '' }, { status: 500 })
  }
}
