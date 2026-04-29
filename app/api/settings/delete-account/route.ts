export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/settings/delete-account — fully deletes the auth user + profile
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let supabaseAdmin: ReturnType<typeof createAdminClient>
    try {
      supabaseAdmin = createAdminClient()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[DELETE /api/settings/delete-account] Admin client error:', msg)
      return NextResponse.json({ error: 'Account deletion is temporarily unavailable.' }, { status: 500 })
    }

    // Soft-delete the profile with the service-role client so RLS can never
    // leave a deleted account visible in member/search surfaces.
    const { data: deletedProfile, error: softDeleteError } = await supabaseAdmin
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id')
      .maybeSingle()

    if (softDeleteError) {
      console.error('[DELETE /api/settings/delete-account] Profile soft-delete error:', softDeleteError)
      return NextResponse.json({ error: 'Failed to archive your profile. Please try again.' }, { status: 500 })
    }

    if (!deletedProfile) {
      console.error('[DELETE /api/settings/delete-account] Profile not found for user:', user.id)
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
    }

    // Sign out the session before deleting
    await supabase.auth.signOut()

    // Some audit/notification tables keep nullable references to auth.users.
    // Preserve those records while clearing the FK so the auth hard-delete can
    // actually complete and free the email address for re-registration.
    await Promise.allSettled([
      supabaseAdmin.from('campaign_sends').update({ user_id: null }).eq('user_id', user.id),
      supabaseAdmin.from('campaigns').update({ created_by: null }).eq('created_by', user.id),
    ])

    // Fully delete the auth user using the admin client
    // This allows the email to be re-used for a new account
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      console.error('[DELETE /api/settings/delete-account] Auth user delete error:', deleteError)
      // Non-fatal — the profile is already hidden from the platform and the
      // session is cleared, but return a warning so logs do not pretend the
      // auth hard-delete completed.
      return NextResponse.json(
        { success: true, warning: 'Profile archived, but auth user was not deleted, so the email may not be reusable yet.' },
        { status: 207 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/settings/delete-account] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
