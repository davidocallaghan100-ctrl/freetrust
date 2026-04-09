/**
 * POST /api/auth/logout
 * Signs out from ALL sessions (scope: 'global') — not just the current one.
 */
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()
    // 'global' scope invalidates all refresh tokens for this user across all devices
    await supabase.auth.signOut({ scope: 'global' })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 })
  }
}
