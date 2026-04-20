import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const SUPABASE = 'https://auth.freetrust.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  try {
    const { id } = await params
    const res = await fetch(
      `${SUPABASE}/rest/v1/jobs?id=eq.${id}&select=title,description,location_type,location,salary_min,salary_max,salary_currency&limit=1`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return {}
    const [job] = await res.json()
    if (!job) return {}

    const title = job.title ?? 'Job'
    const locationStr = job.location_type === 'remote' ? 'Remote' : (job.location ?? '')
    const salaryStr = job.salary_min
      ? `${job.salary_currency ?? '€'}${job.salary_min}${job.salary_max ? `–${job.salary_max}` : '+'}`
      : ''
    const descSnippet = (job.description ?? '').slice(0, 100)
    const description = [descSnippet, locationStr, salaryStr].filter(Boolean).join(' · ').slice(0, 155)
    const ogImage = `${BASE}/api/og?title=${encodeURIComponent(title)}&category=Jobs`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BASE}/jobs/${id}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: { canonical: `${BASE}/jobs/${id}` },
    }
  } catch {
    return {}
  }
}

export default function JobDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
