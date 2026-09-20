export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// POST /api/articles/[id]/view — count one public article view
export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id: articleId } = await context.params
    if (!UUID_PATTERN.test(articleId)) {
      return NextResponse.json({ error: 'Invalid article id' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: viewCount, error } = await supabase.rpc('increment_article_view_count', {
      p_article_id: articleId,
    })

    if (error) {
      console.error('[POST /api/articles/[id]/view]', error)
      return NextResponse.json({ error: 'Unable to record article view' }, { status: 500 })
    }

    return NextResponse.json({ view_count: Number(viewCount ?? 0) })
  } catch (err) {
    console.error('[POST /api/articles/[id]/view] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
