export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireFreeTrustAdmin } from '@/lib/admin/access'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFreeTrustAdmin()
  if (!auth.ok) return auth.response

  try {
    const body = await request.json().catch(() => ({})) as { status?: unknown; resolution?: unknown }
    const status = typeof body.status === 'string' && ['reviewing', 'resolved', 'dismissed'].includes(body.status)
      ? body.status
      : 'resolved'
    const resolution = typeof body.resolution === 'string' ? body.resolution.trim().slice(0, 1000) : null

    const admin = createAdminClient()
    const update = {
      status,
      resolution,
      resolved_by: auth.user.id,
      resolved_at: status === 'reviewing' ? null : new Date().toISOString(),
    }
    const { data, error } = await admin
      .from('content_reports')
      .update(update)
      .eq('id', params.id)
      .select('id, status, resolved_at, resolution')
      .single()

    if (error) return NextResponse.json({ error: 'Could not update report' }, { status: 500 })
    return NextResponse.json({ success: true, report: data })
  } catch (err) {
    console.error('[admin/moderation resolve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
