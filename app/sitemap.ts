import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { REAL_EVENT_SOURCE_FILTER, REAL_JOB_SOURCE_FILTER } from '@/lib/dataIntegrity'

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
    { url: `${BASE}/about`,       lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/impact`,      lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/safety`,      lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/terms`,       lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${BASE}/login`,       lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
    { url: `${BASE}/signup`,      lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ]

  // Dynamic pages — listings
  let listingUrls: MetadataRoute.Sitemap = []
  let productUrls: MetadataRoute.Sitemap = []
  let jobUrls: MetadataRoute.Sitemap = []
  let articleUrls: MetadataRoute.Sitemap = []
  let eventUrls: MetadataRoute.Sitemap = []
  let organisationUrls: MetadataRoute.Sitemap = []
  let communityUrls: MetadataRoute.Sitemap = []
  let rentShareUrls: MetadataRoute.Sitemap = []

  try {
    const supabase = await createClient()

    const { data: listings } = await supabase
      .from('listings')
      .select('id, updated_at, product_type')
      .eq('status', 'active')
      .eq('product_type', 'service')
      .limit(500)
    if (listings) {
      listingUrls = listings.map(l => ({
        url: `${BASE}/services/${l.id}`,
        lastModified: new Date(l.updated_at ?? now),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }

    const { data: products } = await supabase
      .from('listings')
      .select('id, updated_at')
      .eq('status', 'active')
      .neq('product_type', 'service')
      .limit(500)
    if (products) {
      productUrls = products.map(p => ({
        url: `${BASE}/products/${p.id}`,
        lastModified: new Date(p.updated_at ?? now),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      }))
    }

    const { data: jobs } = await supabase
      .from('jobs')
      .select('id, updated_at')
      .eq('status', 'active')
      .or(REAL_JOB_SOURCE_FILTER)
      .limit(500)
    if (jobs) {
      jobUrls = jobs.map(j => ({
        url: `${BASE}/jobs/${j.id}`,
        lastModified: new Date(j.updated_at ?? now),
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
      .or(REAL_EVENT_SOURCE_FILTER)
      .limit(200)
    if (events) {
      eventUrls = events.map(e => ({
        url: `${BASE}/events/${e.id}`,
        lastModified: new Date(e.updated_at ?? now),
        changeFrequency: 'daily' as const,
        priority: 0.6,
      }))
    }

    const { data: organisations } = await supabase
      .from('organisations')
      .select('id, updated_at')
      .limit(500)
    if (organisations) {
      organisationUrls = organisations.map(o => ({
        url: `${BASE}/organisations/${o.id}`,
        lastModified: new Date(o.updated_at ?? now),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))
    }

    const { data: communities } = await supabase
      .from('communities')
      .select('slug, updated_at')
      .limit(500)
    if (communities) {
      communityUrls = communities
        .filter(c => c.slug)
        .map(c => ({
          url: `${BASE}/community/${c.slug}`,
          lastModified: new Date(c.updated_at ?? now),
          changeFrequency: 'weekly' as const,
          priority: 0.5,
        }))
    }

    const { data: rentShare } = await supabase
      .from('rent_share_listings')
      .select('id, created_at')
      .eq('status', 'active')
      .limit(500)
    if (rentShare) {
      rentShareUrls = rentShare.map(r => ({
        url: `${BASE}/rent-share/${r.id}`,
        lastModified: new Date(r.created_at ?? now),
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      }))
    }
  } catch { /* supabase optional */ }

  return [
    ...staticPages,
    ...listingUrls,
    ...productUrls,
    ...jobUrls,
    ...articleUrls,
    ...eventUrls,
    ...organisationUrls,
    ...communityUrls,
    ...rentShareUrls,
  ]
}
