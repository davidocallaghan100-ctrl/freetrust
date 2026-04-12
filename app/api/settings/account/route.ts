export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/settings/account — update profile fields
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // full_name is kept in the allowlist for backward compat. The DB trigger
    // profiles_sync_full_name keeps it in sync with first_name + last_name.
    //
    // Globalisation fields (country, region, city, lat/lng, location_label,
    // currency_code) are allowlisted so the settings page can persist the
    // user's structured location + preferred currency.
    const allowed = [
      'first_name', 'last_name', 'full_name', 'username', 'bio', 'website', 'avatar_url',
      // Legacy free-text
      'location',
      // Globalisation
      'country', 'region', 'city', 'latitude', 'longitude', 'location_label', 'currency_code',
    ] as const
    type AllowedKey = typeof allowed[number]
    const updates: Partial<Record<AllowedKey, unknown>> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }
    // Normalise country to uppercase ISO-alpha-2
    if (typeof updates.country === 'string') {
      updates.country = (updates.country as string).toUpperCase()
    }
    if (typeof updates.currency_code === 'string') {
      updates.currency_code = (updates.currency_code as string).toUpperCase()
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/settings/account]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[PATCH /api/settings/account] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
