export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { storiesPathFromPublicUrl } from '@/lib/storage/directUpload'

// GET /api/cron/stories-cleanup
// Invoked daily by Vercel Cron (see vercel.json) — same auth pattern as the
// other /api/cron/* routes (Authorization: Bearer <CRON_SECRET>).
//
// Calls the cleanup_expired_stories() Postgres function, which deletes
// stories that expired more than 7 days ago and were never saved as a
// Memory, returning the deleted rows. We then remove the corresponding
// objects from the `stories` storage bucket — skipping any media_url that's
// still referenced by another live story or a memory (e.g. it was reposted,
// or it was saved as a memory by a *different* story row pointing at the
// same file, which shouldn't normally happen but is checked defensively).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()

    const { data: deleted, error } = await admin.rpc('cleanup_expired_stories')
    if (error) {
      console.error('[cron/stories-cleanup] cleanup_expired_stories failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const deletedRows = (deleted ?? []) as { id: string; media_url: string }[]
    if (deletedRows.length === 0) {
      return NextResponse.json({ deletedStories: 0, storageObjectsRemoved: 0 })
    }

    const mediaUrls = deletedRows.map(r => r.media_url)

    // A media_url could still be referenced by another story (repost) or a
    // memory — only remove storage objects that are now fully orphaned.
    const { data: stillReferencedStories } = await admin.from('stories').select('media_url').in('media_url', mediaUrls)
    const { data: stillReferencedMemories } = await admin.from('memories').select('media_url').in('media_url', mediaUrls)
    const stillReferenced = new Set([
      ...(stillReferencedStories ?? []).map(r => r.media_url as string),
      ...(stillReferencedMemories ?? []).map(r => r.media_url as string),
    ])

    const pathsToRemove = mediaUrls
      .filter(url => !stillReferenced.has(url))
      .map(url => storiesPathFromPublicUrl(url))
      .filter((p): p is string => Boolean(p))

    let storageObjectsRemoved = 0
    if (pathsToRemove.length > 0) {
      const { error: removeErr } = await admin.storage.from('stories').remove(pathsToRemove)
      if (removeErr) {
        console.error('[cron/stories-cleanup] storage removal failed:', removeErr.message)
      } else {
        storageObjectsRemoved = pathsToRemove.length
      }
    }

    console.log(`[cron/stories-cleanup] deleted ${deletedRows.length} stories, removed ${storageObjectsRemoved} storage objects`)
    return NextResponse.json({ deletedStories: deletedRows.length, storageObjectsRemoved })
  } catch (err) {
    console.error('[cron/stories-cleanup] unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
