export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existing } = await supabase
      .from('feed_saves')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('feed_saves').delete().eq('post_id', id).eq('user_id', user.id)

      const { data: postData } = await supabase
        .from('feed_posts')
        .select('saves_count')
        .eq('id', id)
        .single()
      if (postData) {
        await supabase
          .from('feed_posts')
          .update({ saves_count: Math.max(0, (postData.saves_count ?? 1) - 1) })
          .eq('id', id)
      }

      return NextResponse.json({ saved: false })
    } else {
      await supabase.from('feed_saves').insert({ post_id: id, user_id: user.id })

      const { data: postData } = await supabase
        .from('feed_posts')
        .select('saves_count')
        .eq('id', id)
        .single()
      if (postData) {
        await supabase
          .from('feed_posts')
          .update({ saves_count: (postData.saves_count ?? 0) + 1 })
          .eq('id', id)
      }

      return NextResponse.json({ saved: true })
    }
  } catch (err) {
    console.error('POST save error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
