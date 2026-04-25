// This debug endpoint has been intentionally disabled in all environments.
// It previously leaked SUPABASE_SERVICE_ROLE_KEY prefix and internal DB state.
// Do not re-enable without adding strict admin-role auth and environment gating.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
