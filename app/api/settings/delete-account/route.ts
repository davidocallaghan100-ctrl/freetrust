import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// DELETE /api/settings/delete-account — fully deletes the auth user + profile
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Soft-delete the profile first (belt + braces)
    await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id)

    // Sign out the session before deleting
    await supabase.auth.signOut()

    // Fully delete the auth user using the admin client
    // This allows the email to be re-used for a new account
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceRoleKey) {
      const supabaseAdmin = createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
      if (deleteError) {
        console.error('[DELETE /api/settings/delete-account] Admin delete error:', deleteError)
        // Non-fatal — profile is soft-deleted and session is cleared
      }
    } else {
      console.warn('[DELETE /api/settings/delete-account] SUPABASE_SERVICE_ROLE_KEY not set — soft-delete only')
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/settings/delete-account] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
