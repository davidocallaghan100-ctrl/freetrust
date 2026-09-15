export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/messages/unread-count — total unread message count for the
// current user, across all conversations.
//
// Deliberately its own lightweight endpoint (rather than reusing the
// full /api/messages inbox response) so nav-chrome components (the
// header message bell, the Sidebar/drawer "Messages" link badge) can
// show a number without paying for the full inbox fetch on every page
// of the app. Backed by the same single-query RPC
// (get_unread_message_count, see
// supabase/migrations/20260818120000_message_inbox_perf.sql) used by
// the inbox route's unread math, so the two stay consistent.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin.rpc('get_unread_message_count', { p_user_id: user.id })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ unread_count: Number(data) || 0 })
  } catch (err) {
    console.error('[GET /api/messages/unread-count]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
