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
      `${SUPABASE}/rest/v1/listings?id=eq.${id}&select=title,description,cover_image,images&limit=1`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return {}
    const [listing] = await res.json()
    if (!listing) return {}

    const title = listing.title ?? 'Service'
    const description = (listing.description ?? '').slice(0, 155)
    // Keep social crawlers on freetrust.co. Direct Supabase Storage URLs can
    // stall in Facebook's link-preview fetcher even though they load in a
    // normal browser. The route serves the listing image when it is usable and
    // falls back to the static FreeTrust logo when it is not.
    const ogImage = `${BASE}/api/services/${encodeURIComponent(id)}/og-image?v=2`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BASE}/services/${id}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: { canonical: `${BASE}/services/${id}` },
    }
  } catch {
    return {}
  }
}

export default function ServiceDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
