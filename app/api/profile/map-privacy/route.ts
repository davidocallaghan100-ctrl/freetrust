// PATCH /api/profile/map-privacy
// Updates the show_on_map preference for the authenticated user
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json() as { show_on_map: boolean }
    if (typeof body.show_on_map !== 'boolean') {
      return NextResponse.json({ error: 'show_on_map must be a boolean' }, { status: 400 })
    }

    const { error } = await supabase
      .from('profiles')
      .update({ show_on_map: body.show_on_map })
      .eq('id', user.id)

    if (error) {
      console.error('[map-privacy] update error:', error)
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
    }

    return NextResponse.json({ show_on_map: body.show_on_map })
  } catch (err) {
    console.error('[PATCH /api/profile/map-privacy]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
