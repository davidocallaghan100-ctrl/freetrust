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

    const body = await req.json()
    const content = (body?.content ?? '').trim()
    const category = (body?.category ?? 'General').trim()

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    if (content.length > 2000) {
      return NextResponse.json({ error: 'Post too long (max 2000 chars)' }, { status: 400 })
    }

    const { data: post, error: insertError } = await supabase
      .from('feed_posts')
      .insert({ author_id: user.id, content, category })
      .select()
      .single()

    if (insertError) {
      console.error('feed_posts insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
    }

    return NextResponse.json({ success: true, post })
  } catch (err) {
    console.error('POST /api/feed/post error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
