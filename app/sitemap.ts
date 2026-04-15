import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

// Canonical site URL for every link the sitemap emits. Uses the
// NEXT_PUBLIC_BASE_URL env var (set on Vercel), falling back to the
// production freetrust.co domain. Previously hardcoded to
// freetrust.vercel.app which pointed search engines at the wrong
// canonical URL after the launch domain was set up.
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const dynamic = 'force-dynamic'

// Priority + changeFrequency rationale:
//   / (landing)                   1.0 daily    — most important page
//   /marketplace /services /jobs  0.9 daily    — primary conversion surfaces
//   /events /communities /members 0.8 weekly   — discovery surfaces
//   /about /impact                0.6 monthly  — static-ish info pages
//   /articles /feed               0.7 daily    — fresh content
//   /browse /community            0.7 daily    — legacy aliases
//   /login /signup                0.3 monthly  — terminal pages
//
// Everything else is dynamic (listings, articles, events, organisations)
// and gets appended below with per-row lastModified timestamps from
// Supabase.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                  lastModified: now, changeFrequency: 'daily',   priority: 1.0 },
    { url: `${BASE}/marketplace`, lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/services`,    lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/products`,    lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/jobs`,        lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${BASE}/events`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/communities`, lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/members`,     lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/articles`,    lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/feed`,        lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/browse`,      lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/community`,   lastModified: now, changeFrequency: 'daily',   priority: 0.7 },
    { url: `${BASE}/about`,       lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/impact`,      lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/login`,       lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/signup`,      lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // Dynamic pages — listings
  let listingUrls: MetadataRoute.Sitemap = []
  let articleUrls: MetadataRoute.Sitemap = []
  let eventUrls: MetadataRoute.Sitemap = []

  try {
    const supabase = await createClient()

    const { data: listings } = await supabase
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')
      .limit(500)
    if (listings) {
      listingUrls = listings.map(l => ({
        url: `${BASE}/services/${l.id}`,
        lastModified: new Date(l.updated_at ?? now),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }

    const { data: articles } = await supabase
      .from('articles')
      .select('slug, updated_at')
      .limit(500)
    if (articles) {
      articleUrls = articles.map(a => ({
        url: `${BASE}/articles/${a.slug}`,
        lastModified: new Date(a.updated_at ?? now),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))
    }

    const { data: events } = await supabase
      .from('events')
      .select('id, updated_at')
      .eq('status', 'published')
      .limit(200)
    if (events) {
      eventUrls = events.map(e => ({
        url: `${BASE}/events/${e.id}`,
        lastModified: new Date(e.updated_at ?? now),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }))
    }
  } catch { /* supabase optional */ }

  return [...staticPages, ...listingUrls, ...articleUrls, ...eventUrls]
}
