import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function estimateReadTime(html: string): number {
  const text = html.replace(/<[^>]+>/g, ' ')
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / 200))
}

// GET /api/articles — list published articles
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const tag = searchParams.get('tag')
    const mine = searchParams.get('mine') === 'true'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')))
    const offset = (page - 1) * limit

    const { data: { user } } = await supabase.auth.getUser()

    let query = supabase
      .from('articles')
      .select('id, slug, title, excerpt, category, tags, clap_count, comment_count, read_time_minutes, published_at, status, profiles!author_id(id, full_name, avatar_url)', { count: 'exact' })
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (mine && user) {
      query = query.eq('author_id', user.id)
    } else {
      query = query.eq('status', 'published')
    }

    if (category) query = query.eq('category', category)
    if (tag) query = query.contains('tags', [tag])

    const { data: articles, error, count } = await query

    if (error) {
      console.error('[GET /api/articles]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ articles: articles ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    console.error('[GET /api/articles] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/articles — create article
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, body: articleBody, status = 'draft', excerpt, featured_image_url, category, tags = [] } = body

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return NextResponse.json({ error: 'Title must be at least 3 characters' }, { status: 400 })
    }
    if (!articleBody || typeof articleBody !== 'string') {
      return NextResponse.json({ error: 'Body is required' }, { status: 400 })
    }
    if (!['draft', 'published'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const baseSlug = slugify(title.trim())
    const suffix = Math.random().toString(36).slice(2, 7)
    const slug = `${baseSlug}-${suffix}`

    const readTime = estimateReadTime(articleBody)

    const { data: article, error: insertError } = await supabase
      .from('articles')
      .insert({
        author_id: user.id,
        title: title.trim(),
        slug,
        excerpt: excerpt?.trim() ?? null,
        body: articleBody,
        featured_image_url: featured_image_url?.trim() ?? null,
        status,
        category: category ?? null,
        tags: Array.isArray(tags) ? tags : [],
        read_time_minutes: readTime,
        published_at: status === 'published' ? new Date().toISOString() : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/articles]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Issue trust if published (DB trigger also handles this, but do it here as backup)
    if (status === 'published') {
      const { error: trustError } = await supabase.rpc('issue_trust', {
        p_user_id: user.id,
        p_amount: 20,
        p_type: 'article_published',
        p_ref: article.id,
        p_desc: `Published article: ${title.trim().slice(0, 100)}`,
      })
      if (trustError) console.warn('[POST /api/articles] Trust issue failed (non-fatal):', trustError.message)
    }

    return NextResponse.json({ article }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/articles] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
