export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/cron/e2e-test-cleanup
// Invoked every 15 minutes by Vercel Cron (see vercel.json) — same auth
// pattern as the other /api/cron/* routes (Authorization: Bearer <CRON_SECRET>).
//
// FreeTrust is a trust platform — test/verification artifacts created by
// E2E checks (e.g. the "Verify Tester" account used to smoke-test the
// Share-to-Story flow) must never linger in production. This job finds and
// removes any such throwaway test rows once the test that created them has
// had time to finish (a 1-hour grace window avoids deleting a test's data
// out from under it while it's still running), then removes the throwaway
// auth user itself.
//
// Recognised test patterns (keep in sync with any new E2E scripts):
//   - profiles/auth users with email like 'ft-%-test-%@example.com'
//   - feed_posts.content containing 'E2E verification post'
const TEST_EMAIL_PATTERN = 'ft-%-test-%@example.com'
const GRACE_PERIOD_MS = 60 * 60 * 1000 // 1 hour

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && authHeader !== `Bearer ${secret}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - GRACE_PERIOD_MS).toISOString()

    // 1. Find stale test profiles (throwaway E2E accounts) past the grace window.
    const { data: testProfiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, email, created_at')
      .ilike('email', TEST_EMAIL_PATTERN)
      .lt('created_at', cutoff)

    if (profilesErr) {
      console.error('[cron/e2e-test-cleanup] profiles lookup failed:', profilesErr.message)
      return NextResponse.json({ error: profilesErr.message }, { status: 500 })
    }

    // 2. Also catch any stray posts matching the E2E marker even if the
    //    posting account doesn't match the email pattern (defensive).
    const { data: testPosts, error: postsErr } = await admin
      .from('feed_posts')
      .select('id, user_id, created_at')
      .ilike('content', '%E2E verification post%')
      .lt('created_at', cutoff)

    if (postsErr) {
      console.error('[cron/e2e-test-cleanup] posts lookup failed:', postsErr.message)
      return NextResponse.json({ error: postsErr.message }, { status: 500 })
    }

    const testUserIds = new Set<string>([
      ...(testProfiles ?? []).map(p => p.id as string),
      ...(testPosts ?? []).map(p => p.user_id as string).filter(Boolean),
    ])

    if (testUserIds.size === 0) {
      return NextResponse.json({ deletedUsers: 0 })
    }

    const userIdList = Array.from(testUserIds)

    // Delete dependent rows first (stories reference feed_posts via
    // shared_post_id, so remove stories before posts).
    await admin.from('stories').delete().in('user_id', userIdList)
    await admin.from('feed_posts').delete().in('user_id', userIdList)
    await admin.from('profiles').delete().in('id', userIdList)

    let authDeleted = 0
    for (const id of userIdList) {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (!error) authDeleted++
      else console.error(`[cron/e2e-test-cleanup] failed to delete auth user ${id}:`, error.message)
    }

    console.log(`[cron/e2e-test-cleanup] cleaned up ${userIdList.length} test account(s), ${authDeleted} auth user(s) removed`)
    return NextResponse.json({ deletedUsers: userIdList.length, authUsersDeleted: authDeleted })
  } catch (err) {
    console.error('[cron/e2e-test-cleanup] unexpected error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
