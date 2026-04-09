'use client'
import Link from 'next/link'
import PostCard, { FeedPost } from '@/components/PostCard'

export default function PostPageClient({
  post,
  related,
}: {
  post: FeedPost
  related: FeedPost[]
}) {
  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Back link */}
        <Link
          href="/feed"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', textDecoration: 'none', marginBottom: '16px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #1e293b', background: '#1e293b' }}
        >
          ← Back to feed
        </Link>

        {/* Main post — expanded with comments open */}
        <PostCard post={post} expanded />

        {/* Related posts */}
        {related.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              More from this author
            </div>
            {related.map(r => <PostCard key={r.id} post={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}
