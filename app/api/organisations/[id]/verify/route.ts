// POST /api/organisations/[id]/verify
// Marks an organisation as verified (is_verified=true).
// Only the platform admin (hardcoded ADMIN_USER_ID env) or the org owner
// can call this. In production this would be gated to an admin dashboard.
//
// Body: { action: 'verify' | 'unverify' }
//
// Requirements:
//   - Caller must be authenticated
//   - Caller must be the org owner or have role='admin' in profiles
//   - Idempotent: re-verifying an already-verified org is a no-op

export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Missing org id' }, { status: 400 })

    // Auth — get calling user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 })

    const admin = createAdminClient()

    // Resolve slug → UUID if needed
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    let orgId = id
    if (!isUUID) {
      const { data: org } = await admin.from('organisations').select('id').eq('slug', id).maybeSingle()
      if (!org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })
      orgId = org.id
    }

    // Fetch the org to check ownership
    const { data: org, error: orgErr } = await admin
      .from('organisations')
      .select('id, creator_id, is_verified, name')
      .eq('id', orgId)
      .maybeSingle()

    if (orgErr || !org) return NextResponse.json({ error: 'Organisation not found' }, { status: 404 })

    // Check caller is org owner OR has platform admin role
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const isOrgOwner = org.creator_id === user.id
    const isPlatformAdmin = callerProfile?.role === 'admin'

    if (!isOrgOwner && !isPlatformAdmin) {
      return NextResponse.json({ error: 'Forbidden — only org owner or platform admin can verify' }, { status: 403 })
    }

    // Parse body
    const body = await req.json().catch(() => ({}))
    const action: 'verify' | 'unverify' = body.action ?? 'verify'

    if (action === 'verify') {
      if (org.is_verified) {
        return NextResponse.json({ ok: true, is_verified: true, message: 'Already verified' })
      }
      const { error: updateErr } = await admin
        .from('organisations')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
          verified_by: user.id,
        })
        .eq('id', orgId)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
      return NextResponse.json({ ok: true, is_verified: true })
    }

    if (action === 'unverify') {
      const { error: updateErr } = await admin
        .from('organisations')
        .update({
          is_verified: false,
          verified_at: null,
          verified_by: null,
        })
        .eq('id', orgId)

      if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })
      return NextResponse.json({ ok: true, is_verified: false })
    }

    return NextResponse.json({ error: 'Invalid action — must be "verify" or "unverify"' }, { status: 400 })
  } catch (err) {
    console.error('[POST /api/organisations/[id]/verify]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
