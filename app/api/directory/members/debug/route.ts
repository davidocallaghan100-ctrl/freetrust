// This debug endpoint has been intentionally disabled in all environments.
// It had ZERO auth check and leaked real user PII (auth.users id/email/created_at
// and profiles id/email/full_name/created_at for all users) to any unauthenticated
// caller. Confirmed exploitable on production via a plain GET request (2026-08-16
// security audit). Do not re-enable without adding requireFreeTrustAdmin() gating
// AND removing the PII from the response shape (aggregate counts only, no rows).
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
