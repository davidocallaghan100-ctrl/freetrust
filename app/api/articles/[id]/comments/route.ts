import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/articles/[id]/comments — list comments
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { id: articleId } = await context.params

    const { data: comments, error } = await supabase
      .from('article_comments')
      .select('id, body, created_at, updated_at, author_id, profiles!author_id(id, full_name, avatar_url)')
      .eq('article_id', articleId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[GET /api/articles/[id]/comments]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ comments: comments ?? [] })
  } catch (err) {
    console.error('[GET /api/articles/[id]/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/articles/[id]/comments — add comment
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { id: articleId } = await context.params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { body: commentBody, parent_id } = body

    if (!commentBody || typeof commentBody !== 'string' || commentBody.trim().length === 0) {
      return NextResponse.json({ error: 'Comment body is required' }, { status: 400 })
    }
    if (commentBody.trim().length > 2000) {
      return NextResponse.json({ error: 'Comment must be under 2000 characters' }, { status: 400 })
    }

    const { data: comment, error: insertError } = await supabase
      .from('article_comments')
      .insert({
        article_id: articleId,
        author_id: user.id,
        body: commentBody.trim(),
        parent_id: parent_id ?? null,
      })
      .select('id, body, created_at, updated_at, author_id, profiles!author_id(id, full_name, avatar_url)')
      .single()

    if (insertError) {
      console.error('[POST /api/articles/[id]/comments]', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Increment comment_count on article
    const { data: art } = await supabase.from('articles').select('comment_count').eq('id', articleId).single()
    await supabase.from('articles').update({ comment_count: (art?.comment_count ?? 0) + 1 }).eq('id', articleId)

    return NextResponse.json({ comment }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/articles/[id]/comments]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
