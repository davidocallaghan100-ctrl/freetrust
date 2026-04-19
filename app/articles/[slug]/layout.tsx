import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const SUPABASE = 'https://tioqakxnqjxyuzgnwhrb.supabase.co'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  try {
    const { slug } = await params
    const res = await fetch(
      `${SUPABASE}/rest/v1/articles?slug=eq.${slug}&select=title,excerpt,cover_image,author_name&limit=1`,
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
    const ogImage = article.cover_image
      ?? `${BASE}/api/og?title=${encodeURIComponent(title)}&category=Articles`

    return {
      title,
      description,
      authors: article.author_name ? [{ name: article.author_name }] : undefined,
      openGraph: {
        title,
        description,
        url: `${BASE}/articles/${slug}`,
        type: 'article',
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
      },
      alternates: { canonical: `${BASE}/articles/${slug}` },
    }
  } catch {
    return {}
  }
}

export default function ArticleDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
