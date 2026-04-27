/**
 * notifyAllMembersNewPost
 *
 * Fan-out fired (fire-and-forget) from the two post-creation API routes
 * whenever a member publishes a new feed post:
 *   - POST /api/feed/posts
 *   - POST /api/feed/post
 *
 * For every member (excluding the author):
 *   1. Inserts a `new_post` in-app notification row (bulk insert)
 *   2. Sends a `new_post` email via lib/resend.ts:sendNewPostEmail
 *      (100 ms delay between sends to stay within Resend rate limits)
 *
 * Never throws. All errors are caught and logged.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { sendNewPostEmail } from '@/lib/resend'
import { sendPushNotification } from '@/lib/push/sendPushNotification'

export interface NewPostFanoutParams {
  postId:         string
  authorId:       string
  authorName:     string
  contentPreview: string
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function notifyAllMembersNewPost(params: NewPostFanoutParams): Promise<void> {
  const { postId, authorId, authorName, contentPreview } = params
  const preview = contentPreview.length > 120 ? contentPreview.slice(0, 120) + '…' : contentPreview
  const postLink = `/feed/${postId}`
  const notificationBody = `${authorName} just posted: "${preview}"`

  try {
    const admin = createAdminClient()

    // 1. Fetch all active (non-archived) members except the author
    const { data: profiles, error: fetchErr } = await admin
      .from('profiles')
      .select('id, full_name, email')
      .neq('id', authorId)
      .is('deleted_at', null)
      .not('email', 'is', null)

    if (fetchErr || !profiles || profiles.length === 0) {
      console.error('[new-post-fanout] failed to fetch profiles:', fetchErr?.message)
      return
    }

    // 2. Bulk-insert in-app notifications
    const notificationRows = profiles.map(p => ({
      user_id: p.id as string,
      type:    'new_post',
      title:   `New post on FreeTrust 👋`,
      body:    notificationBody,
      link:    postLink,
      data:    {
        post_id:     postId,
        author_id:   authorId,
        author_name: authorName,
        post_url:    postLink,
      },
      read: false,
    }))

    const { error: insertErr } = await admin
      .from('notifications')
      .insert(notificationRows)

    if (insertErr) {
      console.error('[new-post-fanout] bulk notification insert failed:', insertErr.message)
      // Continue to send emails even if notification insert failed
    } else {
      console.log(`[new-post-fanout] inserted ${notificationRows.length} in-app notifications for post ${postId}`)
    }

    // 3. Send emails + push notifications with a 100ms delay between each
    let emailsSent = 0
    let pushSent = 0
    for (const profile of profiles) {
      const email = profile.email as string | null
      const name  = (profile.full_name as string | null) ?? 'there'
      const userId = profile.id as string

      if (email) {
        try {
          await sendNewPostEmail(email, name, authorName, preview, postId)
          emailsSent++
        } catch (emailErr) {
          console.error('[new-post-fanout] email failed for', email, emailErr instanceof Error ? emailErr.message : emailErr)
        }
      }

      // Send push notification (best-effort, fire-and-forget per user)
      try {
        const pushed = await sendPushNotification({
          userId,
          title: `New post on FreeTrust 👋`,
          message: `${authorName}: "${preview}"`,
          url: `https://freetrust.co/feed/${postId}`,
        })
        if (pushed) pushSent++
      } catch { /* silent — push is progressive enhancement */ }

      await sleep(100)
    }

    console.log(`[new-post-fanout] sent ${emailsSent} emails, ${pushSent} pushes for post ${postId}`)
  } catch (err) {
    console.error('[new-post-fanout] unexpected error:', err instanceof Error ? err.message : err)
  }
}
