import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ liked: false })
    }

    const { data } = await supabase
      .from('feed_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    return NextResponse.json({ liked: !!data })
  } catch (err) {
    console.error('GET like error:', err)
    return NextResponse.json({ liked: false })
  }
}

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

    // Check if already liked
    const { data: existing } = await supabase
      .from('feed_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Unlike — delete and decrement likes_count
      await supabase.from('feed_likes').delete().eq('post_id', id).eq('user_id', user.id)

      const { data: postData } = await supabase
        .from('feed_posts')
        .select('likes_count')
        .eq('id', id)
        .single()

      if (postData) {
        await supabase
          .from('feed_posts')
          .update({ likes_count: Math.max(0, (postData.likes_count ?? 1) - 1) })
          .eq('id', id)
      }

      return NextResponse.json({ liked: false })
    } else {
      // Like — insert and increment likes_count
      await supabase.from('feed_likes').insert({ post_id: id, user_id: user.id })

      const { data: postData } = await supabase
        .from('feed_posts')
        .select('likes_count, user_id, trust_reward')
        .eq('id', id)
        .single()

      if (postData) {
        const newCount = (postData.likes_count ?? 0) + 1
        await supabase.from('feed_posts').update({ likes_count: newCount }).eq('id', id)

        // Award ₮2 to post author on first 10 likes
        if (newCount <= 10 && postData.user_id && postData.user_id !== user.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('trust_balance')
            .eq('id', postData.user_id)
            .single()

          if (profile) {
            await supabase
              .from('profiles')
              .update({ trust_balance: (profile.trust_balance ?? 0) + 2 })
              .eq('id', postData.user_id)
          }

          await supabase
            .from('feed_posts')
            .update({ trust_reward: (postData.trust_reward ?? 0) + 2 })
            .eq('id', id)
        }
      }

      return NextResponse.json({ liked: true })
    }
  } catch (err) {
    console.error('POST like error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
