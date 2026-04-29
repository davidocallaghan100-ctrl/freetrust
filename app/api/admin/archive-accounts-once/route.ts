export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TARGET_IDS = [
  '46ac102a-d461-46e0-bacc-78567f2fd710',
  '7db8f8de-0804-4a5b-9033-b4cf1f0a36e5',
  '8cb69359-96df-4c73-807d-1d3edff4da35',
  'b1aaf6c0-315d-4bf2-b292-9a9b4e897a22',
  'cac90d84-4bdb-4c5f-98e9-21740d81588a',
  '6b26e087-ee47-4064-a446-45cf92189715',
] as const

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-internal-secret')
  if (!process.env.INTERNAL_API_SECRET || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const deletedAt = new Date().toISOString()

  const { data: archived, error: archiveError } = await supabase
    .from('profiles')
    .update({ deleted_at: deletedAt })
    .in('id', TARGET_IDS)
    .select('id, full_name, deleted_at')

  if (archiveError) {
    return NextResponse.json({ error: archiveError.message }, { status: 500 })
  }

  await Promise.allSettled([
    supabase.from('campaign_sends').update({ user_id: null }).in('user_id', TARGET_IDS),
    supabase.from('campaigns').update({ created_by: null }).in('created_by', TARGET_IDS),
  ])

  const authDeletes = []
  for (const id of TARGET_IDS) {
    const { error } = await supabase.auth.admin.deleteUser(id)
    authDeletes.push({ id, ok: !error, error: error?.message ?? null })
  }

  return NextResponse.json({ archived: archived ?? [], authDeletes })
}
