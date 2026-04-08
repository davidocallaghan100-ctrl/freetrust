import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/articles/[id]/clap — get clap counts
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { id: articleId } = await context.params

    const { data: { user } } = await supabase.auth.getUser()

    const { data: article } = await supabase
      .from('articles')
      .select('clap_count')
      .eq('id', articleId)
      .single()

    let userClapCount = 0
    if (user) {
      const { count } = await supabase
        .from('article_claps')
        .select('*', { count: 'exact', head: true })
        .eq('article_id', articleId)
        .eq('user_id', user.id)
      userClapCount = count ?? 0
    }

    return NextResponse.json({
      total_claps: article?.clap_count ?? 0,
      user_clap_count: userClapCount,
    })
  } catch (err) {
    console.error('[GET /api/articles/[id]/clap]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/articles/[id]/clap — add a clap (max 50 per user)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const supabase = await createClient()
    const { id: articleId } = await context.params

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check current user clap count
    const { count: existingCount } = await supabase
      .from('article_claps')
      .select('*', { count: 'exact', head: true })
      .eq('article_id', articleId)
      .eq('user_id', user.id)

    const currentUserClaps = existingCount ?? 0

    if (currentUserClaps >= 50) {
      const { data: art } = await supabase.from('articles').select('clap_count').eq('id', articleId).single()
      return NextResponse.json({
        total_claps: art?.clap_count ?? 0,
        user_clap_count: currentUserClaps,
        message: 'Max claps reached',
      })
    }

    // Insert clap row
    const { error: clapError } = await supabase
      .from('article_claps')
      .insert({ article_id: articleId, user_id: user.id })

    if (clapError) {
      console.error('[POST /api/articles/[id]/clap]', clapError)
      return NextResponse.json({ error: clapError.message }, { status: 500 })
    }

    // Get current total and increment
    const { data: art } = await supabase.from('articles').select('clap_count').eq('id', articleId).single()
    const newTotal = (art?.clap_count ?? 0) + 1
    await supabase.from('articles').update({ clap_count: newTotal }).eq('id', articleId)

    return NextResponse.json({
      total_claps: newTotal,
      user_clap_count: currentUserClaps + 1,
    })
  } catch (err) {
    console.error('[POST /api/articles/[id]/clap]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
