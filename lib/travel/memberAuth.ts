import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function requireTravelMember() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      supabase,
      user: null,
      response: NextResponse.json({ error: 'Members must sign in to search and book travel.' }, { status: 401 }),
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, deleted_at')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError || !profile || profile.deleted_at) {
    return {
      supabase,
      user: null,
      response: NextResponse.json({ error: 'Only active FreeTrust members can search and book travel.' }, { status: 403 }),
    }
  }

  return { supabase, user, response: null }
}
