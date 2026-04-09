export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const admin = createAdminClient()
    const { data } = await admin
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

    const admin = createAdminClient()

    // Check if already liked
    const { data: existing } = await admin
      .from('feed_likes')
      .select('id')
      .eq('post_id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      // Unlike — delete and decrement likes_count
      await admin.from('feed_likes').delete().eq('post_id', id).eq('user_id', user.id)

      const { data: postData } = await admin
        .from('feed_posts')
        .select('likes_count')
        .eq('id', id)
        .single()

      if (postData) {
        await admin
          .from('feed_posts')
          .update({ likes_count: Math.max(0, (postData.likes_count ?? 1) - 1) })
          .eq('id', id)
      }

      return NextResponse.json({ liked: false })
    } else {
      // Like — insert and increment likes_count
      await admin.from('feed_likes').insert({ post_id: id, user_id: user.id })

      const { data: postData } = await admin
        .from('feed_posts')
        .select('likes_count, user_id, trust_reward')
        .eq('id', id)
        .single()

      if (postData) {
        const newCount = (postData.likes_count ?? 0) + 1
        await admin.from('feed_posts').update({ likes_count: newCount }).eq('id', id)

        // Award ₮2 to post author on first 10 likes + send notification
        if (newCount <= 10 && postData.user_id && postData.user_id !== user.id) {
          const { data: likerProfile } = await admin
            .from('profiles')
            .select('full_name, username, trust_balance')
            .eq('id', user.id)
            .maybeSingle()

          const likerName = likerProfile?.full_name ?? likerProfile?.username ?? 'Someone'

          // Award ₮2 trust to post author
          const { data: authorProfile } = await admin
            .from('profiles')
            .select('trust_balance')
            .eq('id', postData.user_id)
            .maybeSingle()

          if (authorProfile) {
            await admin
              .from('profiles')
              .update({ trust_balance: (authorProfile.trust_balance ?? 0) + 2 })
              .eq('id', postData.user_id)
          }

          await admin
            .from('feed_posts')
            .update({ trust_reward: (postData.trust_reward ?? 0) + 2 })
            .eq('id', id)

          // Send notification to post author (non-critical)
          try {
            await admin.from('notifications').insert({
              user_id: postData.user_id,
              type: 'post_like',
              title: `${likerName} liked your post`,
              body: null,
              data: { post_id: id, liker_id: user.id, liker_name: likerName },
              read: false,
            })
          } catch { /* non-critical */ }
        }
      }

      return NextResponse.json({ liked: true })
    }
  } catch (err) {
    console.error('POST like error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
