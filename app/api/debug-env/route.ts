export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Temporary debug endpoint — remove after troubleshooting
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'NOT_SET'
  const serviceKeySet = !!process.env.SUPABASE_SERVICE_ROLE_KEY
  const serviceKeyPrefix = process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 30) ?? 'NOT_SET'

  let count = -1
  let dbError = null
  try {
    const admin = createAdminClient()
    const { count: c, error } = await admin
      .from('outbound_leads')
      .select('*', { count: 'exact', head: true })
    count = c ?? -1
    dbError = error ? error.message : null
  } catch (e: unknown) {
    dbError = e instanceof Error ? e.message : String(e)
  }

  return NextResponse.json({
    supabase_url: supabaseUrl,
    service_key_set: serviceKeySet,
    service_key_prefix: serviceKeyPrefix,
    outbound_leads_count: count,
    db_error: dbError,
  })
}
