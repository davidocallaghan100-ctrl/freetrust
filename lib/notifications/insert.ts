import { createAdminClient } from '@/lib/supabase/admin'

// Shared notification-creation helper. Every API route that used to
// write `admin.from('notifications').insert(...)` inline (or worse,
// `supabase.from('notifications').insert(...)` via the user-session
// client) should call this instead.
//
// Why:
//   1. Uses the admin (service-role) client, which bypasses RLS, so
//      notifications land even on projects where the RLS policies
//      haven't been applied yet (the notifications table itself is
//      a common gotcha — for months it only existed as a schema
//      file in lib/supabase/ that Supabase never auto-applied).
//   2. Never throws. Failures are logged with the notification's
//      type + target and the route continues. Notifications are
//      non-critical side-effects — a broken insert must never bring
//      down the main flow.
//   3. Skips silently when userId is null/undefined so callers don't
//      have to guard upstream.
//   4. Returns { inserted: boolean, id?: string, reason?: string }
//      in case a caller wants to know whether the insert succeeded.

export interface InsertNotificationInput {
  userId: string | null | undefined
  type:   string
  title:  string
  body?:  string | null
  link?:  string | null
}

export interface InsertNotificationResult {
  inserted: boolean
  id?:      string
  reason?:  string
}

export async function insertNotification(
  params: InsertNotificationInput,
): Promise<InsertNotificationResult> {
  const { userId, type, title, body, link } = params

  if (!userId) {
    return { inserted: false, reason: 'no_user_id' }
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        body:    body ?? null,
        link:    link ?? null,
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[notifications] insert failed:', {
        type,
        userId,
        code:    error.code,
        message: error.message,
        details: error.details,
      })
      return { inserted: false, reason: error.message }
    }

    return { inserted: true, id: (data?.id as string | undefined) }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[notifications] insert threw:', { type, userId, msg })
    return { inserted: false, reason: msg }
  }
}
