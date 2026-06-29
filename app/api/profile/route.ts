export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfileCompletionIssues } from '@/lib/profile/completion'

// GET /api/profile — get current user's profile
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .is('deleted_at', null)
      .single()

    if (error) {
      console.error('[GET /api/profile]', error)
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    let hydratedProfile = profile as Record<string, unknown>
    const { data: badge, error: badgeError } = await supabase
      .from('profile_verification_badges')
      .select('status, verified_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!badgeError && badge) {
      hydratedProfile = {
        ...hydratedProfile,
        profile_verification_status: (badge as { status?: string | null }).status ?? null,
        profile_identity_verified_at: (badge as { verified_at?: string | null }).verified_at ?? null,
      }
    }

    const res = NextResponse.json({ profile: hydratedProfile, user })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return res
  } catch (err) {
    console.error('[GET /api/profile] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/profile — update current user's profile
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Whitelist allowed fields. Verification grant fields are deliberately
    // excluded: normal profile owners may submit details for review, but may
    // not set is_verified / verified_at / verified_by themselves.
    const allowed = [
      'full_name', 'bio', 'location', 'website', 'avatar_url', 'cover_url', 'role',
      'cover_position_x', 'cover_position_y', 'cover_rotation', 'cover_scale',
      'vat_registered', 'vat_number',
      'linkedin_url', 'instagram_url', 'twitter_url', 'github_url', 'tiktok_url', 'youtube_url', 'website_url',
      'professional_headline', 'professional_experience', 'verification_details',
    ] as const
    type AllowedKey = typeof allowed[number]
    const updates: Partial<Record<AllowedKey | 'verification_status' | 'verification_submitted_at', unknown>> = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const clamp = (value: unknown, min: number, max: number, fallback: number) => {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) return fallback
      return Math.min(max, Math.max(min, numeric))
    }
    const normalizeRotation = (value: unknown) => {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) return 0
      const roundedToQuarterTurn = Math.round(numeric / 90) * 90
      return ((roundedToQuarterTurn % 360) + 360) % 360
    }

    if ('cover_position_x' in updates) updates.cover_position_x = clamp(updates.cover_position_x, 0, 100, 50)
    if ('cover_position_y' in updates) updates.cover_position_y = clamp(updates.cover_position_y, 0, 100, 50)
    if ('cover_rotation' in updates) updates.cover_rotation = normalizeRotation(updates.cover_rotation)
    if ('cover_scale' in updates) updates.cover_scale = clamp(updates.cover_scale, 1, 2, 1)

    if ('professional_headline' in updates) {
      const value = typeof updates.professional_headline === 'string' ? updates.professional_headline.trim() : ''
      updates.professional_headline = value ? value.slice(0, 160) : null
    }

    if ('professional_experience' in updates) {
      const raw = Array.isArray(updates.professional_experience) ? updates.professional_experience : []
      updates.professional_experience = raw
        .slice(0, 12)
        .map((entry) => {
          const item = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
          const role = typeof item.role === 'string' ? item.role.trim().slice(0, 120) : ''
          const organization = typeof item.organization === 'string' ? item.organization.trim().slice(0, 120) : ''
          const period = typeof item.period === 'string' ? item.period.trim().slice(0, 80) : ''
          const description = typeof item.description === 'string' ? item.description.trim().slice(0, 500) : ''
          return { role, organization, period, description }
        })
        .filter(entry => entry.role || entry.organization || entry.description)
    }

    if ('verification_details' in updates) {
      const raw = updates.verification_details
      const note = raw && typeof raw === 'object' && 'note' in raw
        ? String((raw as { note?: unknown }).note ?? '').trim()
        : typeof raw === 'string'
          ? raw.trim()
          : ''

      if (note) {
        updates.verification_details = {
          note: note.slice(0, 1000),
          submitted_via: 'profile_form',
          updated_at: new Date().toISOString(),
        }

        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('is_verified, verified_at')
          .eq('id', user.id)
          .maybeSingle()

        const alreadyVerified = Boolean((currentProfile as { is_verified?: boolean | null; verified_at?: string | null } | null)?.is_verified || (currentProfile as { verified_at?: string | null } | null)?.verified_at)
        if (!alreadyVerified) {
          updates.verification_status = 'submitted'
          updates.verification_submitted_at = new Date().toISOString()
        }
      } else {
        delete updates.verification_details
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('first_name,last_name,full_name,avatar_url,bio,location,hobbies,onboarding_complete,created_at,deleted_at')
      .eq('id', user.id)
      .is('deleted_at', null)
      .maybeSingle()

    const mergedProfile = { ...(currentProfile ?? {}), ...updates }
    const completionIssues = getProfileCompletionIssues(mergedProfile)
      .filter(issue => issue !== 'onboarding_incomplete')
    if ((currentProfile as { onboarding_complete?: boolean | null } | null)?.onboarding_complete === true && completionIssues.length > 0) {
      return NextResponse.json({ error: 'Your profile must keep a real name, face photo, location, and hobbies to remain visible on FreeTrust.' }, { status: 400 })
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/profile]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (err) {
    console.error('[PATCH /api/profile] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
