export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireFreeTrustAdmin } from '@/lib/admin/access'
import { createAdminClient } from '@/lib/supabase/admin'

type Profile = { id: string; full_name: string | null; username?: string | null; avatar_url: string | null }

export async function GET() {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  try {
    const admin = createAdminClient()
    const { data: reports, error } = await admin
      .from('content_reports')
      .select('id, reporter_id, reported_user_id, post_id, content_type, reason, details, status, created_at, resolved_at, resolved_by, resolution, metadata')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('[admin/moderation]', error)
      return NextResponse.json({ error: 'Could not load moderation queue' }, { status: 500 })
    }

    const ids = Array.from(new Set((reports ?? []).flatMap((report: Record<string, unknown>) => [report.reporter_id, report.reported_user_id]).filter((id): id is string => typeof id === 'string' && Boolean(id))))
    const profileMap: Record<string, Profile> = {}
    if (ids.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', ids)
      for (const profile of (profiles ?? []) as Profile[]) profileMap[profile.id] = profile
    }

    return NextResponse.json({
      reports: (reports ?? []).map((report: Record<string, unknown>) => ({
        ...report,
        reporter: typeof report.reporter_id === 'string' ? profileMap[report.reporter_id] ?? null : null,
        reported_user: typeof report.reported_user_id === 'string' ? profileMap[report.reported_user_id] ?? null : null,
      })),
    })
  } catch (err) {
    console.error('[admin/moderation]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
