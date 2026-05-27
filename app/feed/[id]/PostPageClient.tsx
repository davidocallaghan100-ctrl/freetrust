'use client'
import Link from 'next/link'
import PostCard, { FeedPost } from '@/components/PostCard'

export default function PostPageClient({
  post,
  related,
  currentUserId,
}: {
  post: FeedPost
  related: FeedPost[]
  currentUserId: string | null
}) {
  return (
    <div className="ft-post-detail-page">
      <div className="ft-post-detail-shell">

        {/* Back link */}
        <div className="ft-post-detail-nav">
          <Link href="/feed" className="ft-post-detail-back">
            ← Back to feed
          </Link>
        </div>

        {/* Main post — expanded with comments open */}
        <PostCard post={post} expanded currentUserId={currentUserId ?? undefined} />

        {/* Related posts */}
        {related.length > 0 && (
          <div className="ft-post-detail-related">
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              More from this author
            </div>
            {related.map(r => <PostCard key={r.id} post={r} currentUserId={currentUserId ?? undefined} />)}
          </div>
        )}
      </div>
    </div>
  )
}
