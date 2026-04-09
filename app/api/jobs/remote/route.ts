/**
 * GET /api/jobs/remote
 * Proxies Remotive.com for real remote job listings.
 * No API key required. Cached server-side for 1 hour.
 *
 * Query params:
 *   category  — remotive category slug (e.g. software-development, design, marketing)
 *   search    — free text search
 *   limit     — max results (default 50, max 150)
 */
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'

const REMOTIVE_BASE = 'https://remotive.com/api/remote-jobs'

// Map our internal category names → Remotive slugs
const CAT_MAP: Record<string, string> = {
  'Tech':        'software-development',
  'Design':      'design',
  'Marketing':   'marketing',
  'Sales':       'sales-business',
  'Finance':     'finance',
  'Operations':  'project-management',
  'AI':          'ai-ml',
  'Data':        'data',
  'DevOps':      'devops',
  'Writing':     'writing',
  'QA':          'qa',
  'Product':     'product',
  'HR':          'human-resources',
  'All':         '',
}

interface RemotiveJob {
  id: number
  url: string
  title: string
  company_name: string
  company_logo: string | null
  job_type: string
  publication_date: string
  candidate_required_location: string
  salary: string
  description: string
  tags: string[]
  category: string
}

// Simple in-memory cache
const cache = new Map<string, { data: RemotiveJob[]; fetchedAt: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') ?? 'All'
    const search   = searchParams.get('search') ?? ''
    const limit    = Math.min(150, parseInt(searchParams.get('limit') ?? '50'))

    const remotiveSlug = CAT_MAP[category] ?? ''
    const cacheKey = remotiveSlug || 'all'

    // Check cache
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
      const jobs = filterAndShape(cached.data, search, limit)
      return NextResponse.json({ jobs, source: 'cache' })
    }

    // Fetch from Remotive
    const url = remotiveSlug
      ? `${REMOTIVE_BASE}?category=${remotiveSlug}&limit=100`
      : `${REMOTIVE_BASE}?limit=100`

    const res = await fetch(url, {
      headers: { 'User-Agent': 'FreeTrust/1.0 (freetrust.co)' },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      console.error('[jobs/remote] Remotive returned', res.status)
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 502 })
    }

    const json = await res.json() as { jobs?: RemotiveJob[] }
    const data = json.jobs ?? []

    // Cache it
    cache.set(cacheKey, { data, fetchedAt: Date.now() })

    const jobs = filterAndShape(data, search, limit)
    return NextResponse.json({ jobs, source: 'live' })
  } catch (err) {
    console.error('[jobs/remote] Unexpected error:', err)
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}

function filterAndShape(jobs: RemotiveJob[], search: string, limit: number) {
  let filtered = jobs

  if (search) {
    const q = search.toLowerCase()
    filtered = jobs.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company_name.toLowerCase().includes(q) ||
      j.tags.some(t => t.toLowerCase().includes(q))
    )
  }

  return filtered.slice(0, limit).map(j => ({
    id: String(j.id),
    title: j.title,
    company_name: j.company_name,
    company_logo: j.company_logo,
    job_type: normaliseJobType(j.job_type),
    location_type: 'remote',
    location: j.candidate_required_location || 'Worldwide',
    salary: j.salary || null,
    tags: j.tags.slice(0, 5),
    category: j.category,
    created_at: j.publication_date,
    url: j.url,
    description_snippet: j.description.replace(/<[^>]+>/g, '').slice(0, 200).trim(),
  }))
}

function normaliseJobType(type: string): string {
  const t = type.toLowerCase()
  if (t.includes('full')) return 'full_time'
  if (t.includes('part')) return 'part_time'
  if (t.includes('contract')) return 'contract'
  if (t.includes('freelance')) return 'freelance'
  return 'contract'
}
