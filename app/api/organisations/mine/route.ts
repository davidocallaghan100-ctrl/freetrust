export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/organisations/mine
 * Returns all organisations where the current user is owner or admin.
 * Used by the Post Job / Post Service / Create Event forms to show
 * the "Post as Organisation" selector (LinkedIn-style business pages).
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ organisations: [] })
    }

    const admin = createAdminClient()

    // Get all orgs where user is owner or admin (via membership table)
    const { data: memberships, error: memErr } = await admin
      .from('organisation_members')
      .select('organisation_id, role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])

    if (memErr || !memberships || memberships.length === 0) {
      // Also check if they're the creator of any org (before membership table existed)
      const { data: createdOrgs } = await admin
        .from('organisations')
        .select('id, name, slug, logo_url, tagline, is_verified')
        .eq('creator_id', user.id)
        .eq('status', 'active')
      return NextResponse.json({ organisations: createdOrgs ?? [] })
    }

    const orgIds = memberships.map(m => m.organisation_id)

    const { data: orgs, error: orgErr } = await admin
      .from('organisations')
      .select('id, name, slug, logo_url, tagline, is_verified, creator_id')
      .in('id', orgIds)
      .eq('status', 'active')
      .order('name')

    if (orgErr) {
      console.error('[GET /api/organisations/mine]', orgErr)
      return NextResponse.json({ error: orgErr.message }, { status: 500 })
    }

    // Attach the user's role to each org
    const orgsWithRole = (orgs ?? []).map(org => {
      const membership = memberships.find(m => m.organisation_id === org.id)
      return {
        ...org,
        userRole: membership?.role ?? (org.creator_id === user.id ? 'owner' : 'member'),
      }
    })

    return NextResponse.json({ organisations: orgsWithRole })
  } catch (err) {
    console.error('[GET /api/organisations/mine] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
