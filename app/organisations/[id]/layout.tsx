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
      `${SUPABASE}/rest/v1/organisations?id=eq.${id}&select=name,description,logo_url,type&limit=1`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return {}
    const [org] = await res.json()
    if (!org) return {}

    const title = org.name ?? 'Organisation'
    const description = org.description
      ? (org.description as string).slice(0, 155)
      : `View ${title} on FreeTrust — a verified organisation in the community economy.`
    const ogImage = org.logo_url
      ?? `${BASE}/api/og?title=${encodeURIComponent(title)}&category=Organisations`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BASE}/organisations/${id}`,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: { canonical: `${BASE}/organisations/${id}` },
    }
  } catch {
    return {}
  }
}

export default function OrganisationDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
