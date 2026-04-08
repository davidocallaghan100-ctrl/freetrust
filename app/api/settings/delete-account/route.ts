import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/settings/delete-account — soft-delete account (sets deleted_at)
export async function DELETE() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) {
      console.error('[DELETE /api/settings/delete-account]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Sign out the user
    await supabase.auth.signOut()

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE /api/settings/delete-account] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
