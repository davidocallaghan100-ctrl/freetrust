import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const SUPABASE = 'https://tioqakxnqjxyuzgnwhrb.supabase.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  try {
    const { id } = await params
    const res = await fetch(
      `${SUPABASE}/rest/v1/events?id=eq.${id}&select=title,description,cover_image,start_date,location&limit=1`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return {}
    const [event] = await res.json()
    if (!event) return {}

    const title = event.title ?? 'Event'
    const description = (event.description ?? '').slice(0, 155)
    const ogImage = event.cover_image
      ?? `${BASE}/api/og?title=${encodeURIComponent(title)}&category=Events`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BASE}/events/${id}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: { canonical: `${BASE}/events/${id}` },
    }
  } catch {
    return {}
  }
}

export default function EventDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
