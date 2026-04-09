export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/communities/[slug]/posts/[postId]/vote — upvote post
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; postId: string }> }
) {
  try {
    const { postId } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Try to insert vote (unique constraint will reject duplicate)
    const { error: voteError } = await supabase
      .from('community_post_votes')
      .insert({ post_id: postId, user_id: user.id })

    if (voteError) {
      // 23505 = unique violation = already voted
      if (voteError.code === '23505') {
        const { data: post } = await supabase
          .from('community_posts')
          .select('upvotes')
          .eq('id', postId)
          .single()
        return NextResponse.json({ upvotes: post?.upvotes ?? 0, alreadyVoted: true })
      }
      return NextResponse.json({ error: voteError.message }, { status: 500 })
    }

    // Increment upvotes
    const { data: post, error: updateError } = await supabase
      .from('community_posts')
      .update({ upvotes: supabase.rpc('increment', { x: 1 }) as unknown as number })
      .eq('id', postId)
      .select('upvotes')
      .single()

    // Fallback: manual increment
    if (updateError || !post) {
      const { data: current } = await supabase
        .from('community_posts')
        .select('upvotes')
        .eq('id', postId)
        .single()
      const newCount = (current?.upvotes ?? 0) + 1
      await supabase
        .from('community_posts')
        .update({ upvotes: newCount })
        .eq('id', postId)
      return NextResponse.json({ upvotes: newCount })
    }

    return NextResponse.json({ upvotes: post.upvotes })
  } catch (err) {
    console.error('[POST vote]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
