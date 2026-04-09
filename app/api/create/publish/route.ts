export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as {
      type: string
      data: Record<string, unknown>
      visibility?: string
      location?: string
      taggedUsers?: string
      category?: string
    }

    const { type, data, visibility = 'public', location, taggedUsers, category } = body

    let redirectUrl = '/feed'

    if (type === 'article') {
      const slug = String(data.title ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + Date.now()

      const { error } = await supabase.from('articles').insert({
        author_id: user.id,
        title: data.title,
        slug,
        body: data.body,
        excerpt: String(data.body ?? '').slice(0, 200),
        featured_image_url: data.cover_image_url ?? null,
        status: 'published',
        category: category ?? 'General',
        published_at: new Date().toISOString(),
      })
      if (error) throw error
      redirectUrl = '/articles'
    } else if (type === 'job') {
      const { error } = await supabase.from('jobs').insert({
        poster_id: user.id,
        title: data.title,
        description: data.description,
        requirements: data.requirements,
        job_type: data.job_type ?? 'Full-time',
        location: data.location ?? location ?? null,
        salary_min: data.salary_min ? Number(data.salary_min) : null,
        salary_max: data.salary_max ? Number(data.salary_max) : null,
        salary_currency: 'USD',
        category: category ?? 'General',
        status: 'open',
      })
      if (error) throw error
      redirectUrl = '/jobs'
    } else if (type === 'event') {
      // Use community_events table, needs community_id — use null / first community
      const { data: firstCommunity } = await supabase
        .from('communities')
        .select('id')
        .limit(1)
        .maybeSingle()

      const { error } = await supabase.from('community_events').insert({
        community_id: firstCommunity?.id ?? null,
        title: data.title,
        description: data.description,
        starts_at: data.start_date,
        ends_at: data.end_date ?? null,
        is_online: false,
      })
      if (error) throw error
      redirectUrl = '/events'
    } else if (type === 'service') {
      const { error } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: data.title,
        description: data.description,
        price: data.price ? Number(data.price) : 0,
        currency: 'TRUST',
        status: 'active',
        images: [],
        tags: [],
      })
      if (error) throw error
      redirectUrl = '/services'
    } else if (type === 'product') {
      const { error } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: data.title,
        description: data.description,
        price: data.price ? Number(data.price) : 0,
        currency: 'TRUST',
        status: 'active',
        images: data.images ?? [],
        tags: [],
      })
      if (error) throw error
      redirectUrl = '/products'
    } else {
      // photo, video, short, link, poll → feed_posts
      const mediaUrl = (data.media_url as string | null | undefined) ?? null

      const typeContentMap: Record<string, { content: string; media_url?: string | null; title?: string; link_url?: string }> = {
        photo: { content: String(data.caption ?? ''), media_url: mediaUrl, title: undefined },
        video: { content: String(data.description ?? ''), title: String(data.title ?? ''), media_url: mediaUrl },
        short: { content: String(data.caption ?? ''), media_url: mediaUrl },
        link: { content: String(data.description ?? ''), link_url: String(data.url ?? ''), title: String(data.link_title ?? '') },
        poll: { content: JSON.stringify({ question: data.question, options: data.options, duration: data.duration }), title: String(data.question ?? '') },
      }

      const mapped = typeContentMap[type] ?? { content: String(data.content ?? ''), media_url: mediaUrl }

      const { error } = await supabase.from('feed_posts').insert({
        user_id: user.id,
        type,
        content: mapped.content,
        title: mapped.title ?? null,
        link_url: mapped.link_url ?? null,
        media_url: mapped.media_url ?? null,
        media_type: type === 'photo' ? 'image' : type === 'video' || type === 'short' ? 'video' : null,
      })
      if (error) throw error
    }

    return NextResponse.json({ success: true, redirectUrl })
  } catch (err) {
    console.error('[publish]', err)
    return NextResponse.json({ error: 'Failed to publish' }, { status: 500 })
  }
}
