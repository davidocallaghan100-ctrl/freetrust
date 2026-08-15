/**
 * notifyConnectionsNewStory
 *
 * Fire-and-forget fan-out triggered from POST /api/stories whenever a member
 * publishes a new Story. Sends a push notification (existing VAPID/Web Push
 * system, via lib/push/sendPushNotification.ts) to every one of the poster's
 * connections (defined as: users who follow the poster in `user_follows`,
 * i.e. people who'd see the poster's Story in their own Stories bar) — but
 * ONLY to connections who have explicitly opted in to Stories notifications.
 *
 * Unlike lib/notifications/new-post-fanout.ts (which fans out to ALL members
 * unconditionally for feed posts), Stories notifications default to OFF per
 * David's 2026-08-11 decision, so this function explicitly checks
 * profiles.notification_prefs->>'stories_enabled' === true for each
 * recipient before sending — missing/false/null are all treated as opted out.
 *
 * No in-app notification row or email is sent for Stories (push-only, per
 * spec). Never throws — all errors are caught and logged.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendPushNotification } from '@/lib/push/sendPushNotification'

export interface StoryFanoutParams {
  storyId:    string
  posterId:   string
  posterName: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function notifyConnectionsNewStory(params: StoryFanoutParams): Promise<void> {
  const { storyId, posterId, posterName } = params

  try {
    const admin = createAdminClient()

    // 1. Find the poster's connections — users who follow the poster.
    const { data: followRows, error: followErr } = await admin
      .from('user_follows')
      .select('follower_id')
      .eq('following_id', posterId)

    if (followErr) {
      console.error('[story-fanout] failed to fetch followers:', followErr.message)
      return
    }
    if (!followRows || followRows.length === 0) return

    const followerIds = followRows.map(r => r.follower_id as string)

    // 2. Fetch notification_prefs for those followers and keep only the ones
    // who have explicitly opted in to Stories notifications.
    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, notification_prefs, deleted_at')
      .in('id', followerIds)
      .is('deleted_at', null)

    if (profilesErr || !profiles) {
      console.error('[story-fanout] failed to fetch profiles:', profilesErr?.message)
      return
    }

    const optedIn = profiles.filter(p => {
      const prefs = (p.notification_prefs ?? {}) as Record<string, unknown>
      return prefs.stories_enabled === true
    })

    if (optedIn.length === 0) return

    let pushSent = 0
    for (const profile of optedIn) {
      try {
        const pushed = await sendPushNotification({
          userId: profile.id as string,
          title: `${posterName} posted a new Story`,
          message: `Tap to view before it expires in 24h.`,
          url: `https://freetrust.co/feed?story=${storyId}`,
        })
        if (pushed) pushSent++
      } catch { /* silent — push is progressive enhancement */ }

      await sleep(100)
    }

    console.log(`[story-fanout] sent ${pushSent}/${optedIn.length} pushes for story ${storyId}`)
  } catch (err) {
    console.error('[story-fanout] unexpected error:', err instanceof Error ? err.message : err)
  }
}
