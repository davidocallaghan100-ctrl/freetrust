import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const SUPABASE = 'https://auth.freetrust.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  try {
    const { slug } = await params
    const encodedSlug = encodeURIComponent(slug)
    const res = await fetch(
      `${SUPABASE}/rest/v1/articles?slug=eq.${encodedSlug}&status=eq.published&select=title,excerpt,featured_image_url,updated_at&limit=1`,
      {
        headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
        next: { revalidate: 3600 },
      }
    )
    if (!res.ok) return {}
    const [article] = await res.json()
    if (!article) return {}

    const title = article.title ?? 'Article'
    const description = (article.excerpt ?? '').slice(0, 155)
    // Keep social crawlers on freetrust.co. The article cover route proxies
    // public Supabase images and falls back to the static FreeTrust logo when
    // an article has no compatible cover image.
    const imageVersion = typeof article.updated_at === 'string'
      ? encodeURIComponent(article.updated_at)
      : '1'
    const ogImage = `${BASE}/api/articles/${encodedSlug}/og-image?v=${imageVersion}&format=wide-v2`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: `${BASE}/articles/${encodedSlug}`,
        type: 'article',
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: { canonical: `${BASE}/articles/${encodedSlug}` },
    }
  } catch {
    return {}
  }
}

export default function ArticleDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
