export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toPgTagArray } from '@/lib/supabase/text-array'
import { hasProfilePhoto, hasRealName } from '@/lib/profile/completion'

// POST /api/onboarding — save onboarding profile data
// NOTE: ₮200 trust is awarded exclusively in /auth/callback on signup.
//       Do NOT award trust here — it would double-count for email signups.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      account_type,
      // first_name + last_name are the canonical fields now. full_name
      // is still accepted for backwards compatibility (e.g. if an older
      // client ships a pre-split payload) but is derived from the two
      // parts when both are present.
      first_name,
      last_name,
      full_name,
      bio, location,
      hobbies,
      avatar_url, cover_url,
    } = body

    // Normalise name fields — trim, coerce to string, and derive
    // full_name from first/last if they're present. The DB trigger in
    // 20260412_profiles_first_last_name.sql also keeps full_name in
    // sync, but writing it here makes the server response deterministic
    // regardless of trigger state.
    const firstNameClean = typeof first_name === 'string' ? first_name.trim() : ''
    const lastNameClean  = typeof last_name  === 'string' ? last_name.trim()  : ''
    const derivedFullName = [firstNameClean, lastNameClean].filter(Boolean).join(' ')
    const fullNameClean = derivedFullName || (typeof full_name === 'string' ? full_name.trim() : '')

    const bioClean = typeof bio === 'string' ? bio.trim() : ''
    const locationClean = typeof location === 'string' ? location.trim() : ''
    const hobbiesClean = Array.isArray(hobbies)
      ? hobbies.map((item) => typeof item === 'string' ? item.trim() : '').filter(Boolean)
      : []

    if (!hasRealName({ first_name: firstNameClean, last_name: lastNameClean, full_name: fullNameClean })) {
      return NextResponse.json({ error: 'Please enter your real first and last name.' }, { status: 400 })
    }
    if (!hasProfilePhoto({ avatar_url })) {
      return NextResponse.json({ error: 'A real profile photo is required before your account can be completed.' }, { status: 400 })
    }
    if (locationClean.length < 2) {
      return NextResponse.json({ error: 'Please add your city or location.' }, { status: 400 })
    }
    if (hobbiesClean.length === 0) {
      return NextResponse.json({ error: 'Please add at least one hobby or interest.' }, { status: 400 })
    }

    // Read only base-schema columns that are guaranteed to exist.
    // Avoid selecting extended columns (onboarding_complete, account_type, etc.)
    // which are added by a migration that may not yet be applied to the live DB.
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single()

    // ── Step 1: update core columns (guaranteed in base schema) ──────────────
    // bio and location live in the base schema so this update ALWAYS works,
    // even if the extended-columns migration hasn't been applied yet.
    //
    // first_name / last_name are added by 20260412_profiles_first_last_name.sql
    // and are included here as a "best effort" — if the migration hasn't
    // landed the whole update will error and the catch below will surface it.
    const { error: coreError } = await supabase
      .from('profiles')
      .update({
        first_name: firstNameClean || null,
        last_name:  lastNameClean  || null,
        full_name:  fullNameClean || profile?.full_name || null,
        bio: bioClean || null,
        location: locationClean || null,
        // Prefer the freshly uploaded avatar_url from the request body, then
        // fall back to whatever is already stored — never overwrite with null.
        avatar_url: avatar_url ?? profile?.avatar_url ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (coreError) {
      console.error('[POST /api/onboarding] core update error:', coreError)
      return NextResponse.json({ error: coreError.message }, { status: 500 })
    }

    // ── Step 2: update extended columns (best-effort) ────────────────────────
    // These columns are added by the 20260410_profiles_extended_columns migration.
    // If it hasn't been applied yet the update will fail — that's acceptable
    // because the important fields (bio, location) were already saved above.
    //
    // Some older production schemas do not have skills/interests/purpose.
    // Do not write those optional UI-only arrays here; keep onboarding focused
    // on the columns the current production profile schema actually supports.
    // cover_url is optional — the onboarding UI doesn't gate Continue on it.
    // Only include it in the update when the client actually sent a value so
    // we don't overwrite a cover the user set via the settings page with null.
    //
    // hobbies is a text[] column added by 20260414000000_profiles_hobbies.sql.
    // It's encoded via toPgTagArray() to sidestep the PostgREST "The string
    // did not match the expected pattern" JSON → text[] coercion bug.
    // Included only if the client actually sent a non-empty array so we
    // don't clobber a previously-set list with an empty one when a user
    // re-runs onboarding and hits Skip on the hobbies step.
    const extendedUpdates: Record<string, unknown> = {
      account_type: account_type ?? 'individual',
      onboarding_complete: true,
    }
    if (cover_url) extendedUpdates.cover_url = cover_url
    extendedUpdates.hobbies = toPgTagArray(hobbiesClean)

    const { error: extendedError } = await supabase
      .from('profiles')
      .update(extendedUpdates)
      .eq('id', user.id)
    if (extendedError) {
      // The extended update contains account_type and onboarding_complete.
      // If it fails, the user would be sent through signup/onboarding again on
      // the next auth callback, so fail loudly instead of pretending setup was
      // saved.
      console.error('[POST /api/onboarding] extended update error:', extendedError)
      return NextResponse.json({ error: extendedError.message }, { status: 500 })
    }

    // Read trust balance to confirm ₮200 was already issued at signup
    const { data: tb } = await supabase
      .from('trust_balances')
      .select('balance')
      .eq('user_id', user.id)
      .maybeSingle()

    const trustBalance = tb?.balance ?? 0

    return NextResponse.json({ ok: true, trust_awarded: trustBalance })
  } catch (err) {
    console.error('[POST /api/onboarding]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
