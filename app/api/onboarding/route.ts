export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/onboarding — save onboarding profile data
// NOTE: ₮25 trust is awarded exclusively in /auth/callback on signup.
//       Do NOT award trust here — it would double-count for email signups.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const {
      account_type, full_name, bio, location,
      skills, interests, purpose,
      avatar_url, cover_url,
    } = body

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
    const { error: coreError } = await supabase
      .from('profiles')
      .update({
        full_name: full_name || profile?.full_name || null,
        bio: bio || null,
        location: location || null,
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
    // cover_url is optional — the onboarding UI doesn't gate Continue on it.
    // Only include it in the update when the client actually sent a value so
    // we don't overwrite a cover the user set via the settings page with null.
    const extendedUpdates: Record<string, unknown> = {
      account_type: account_type ?? 'individual',
      skills: skills ?? [],
      interests: interests ?? [],
      purpose: purpose ?? [],
      onboarding_complete: true,
    }
    if (cover_url) extendedUpdates.cover_url = cover_url

    await supabase
      .from('profiles')
      .update(extendedUpdates)
      .eq('id', user.id)

    // Read trust balance to confirm ₮25 was already issued at signup
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
