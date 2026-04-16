export const dynamic = 'force-dynamic'
export const revalidate = 0

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/impact/suggest — user submission for a new cause.
//
// The form at the bottom of /impact collects a name + description +
// optional category + optional email. Anons can submit too (no
// required auth) — if the user is logged in we also attach their
// user_id + email so admin can follow up.
//
// Writes via the admin client so the insert never depends on RLS
// policies being correctly applied to the cause_suggestions table
// (the table is created by 20260415000013_irish_impact_causes.sql
// with a permissive INSERT policy, but belt-and-braces).
//
// Throttling: reject submissions where the same user_id OR email
// has already submitted in the last 5 minutes. Without this the
// endpoint is a spam vector.
const THROTTLE_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await req.json().catch(() => null) as {
      name?:        unknown
      description?: unknown
      category?:    unknown
      email?:       unknown
    } | null

    const name        = typeof body?.name        === 'string' ? body.name.trim()        : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const category    = typeof body?.category    === 'string' ? body.category.trim()    : ''
    const emailBody   = typeof body?.email       === 'string' ? body.email.trim()       : ''

    if (name.length < 3 || name.length > 120) {
      return NextResponse.json(
        { error: 'Cause name must be 3–120 characters' },
        { status: 400 },
      )
    }
    if (description.length < 20 || description.length > 1000) {
      return NextResponse.json(
        { error: 'Description must be 20–1000 characters' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // Resolve the caller's profile email when authenticated — admin
    // contact goes through this regardless of whether they typed one
    // into the form.
    let resolvedEmail: string | null = emailBody || null
    if (user && !resolvedEmail) {
      const { data: profile } = await admin
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle()
      resolvedEmail = (profile?.email as string | null) ?? null
    }

    // Throttle: same user (or email) can't spam submissions.
    const sinceIso = new Date(Date.now() - THROTTLE_MS).toISOString()
    let throttleCount = 0
    if (user) {
      const { count } = await admin
        .from('cause_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', sinceIso)
      throttleCount = count ?? 0
    } else if (resolvedEmail) {
      const { count } = await admin
        .from('cause_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('email', resolvedEmail)
        .gte('created_at', sinceIso)
      throttleCount = count ?? 0
    }
    if (throttleCount > 0) {
      return NextResponse.json(
        { error: 'You\'ve already submitted a suggestion recently. Please wait a few minutes before submitting another.' },
        { status: 429 },
      )
    }

    const { data, error } = await admin
      .from('cause_suggestions')
      .insert({
        user_id:     user?.id ?? null,
        name,
        description,
        category:    category || null,
        email:       resolvedEmail,
        status:      'pending',
      })
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('[POST /api/impact/suggest] insert failed:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      id: data?.id,
      message: 'Thank you! Your suggestion has been submitted for review.',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/impact/suggest] unexpected:', msg, err)
    return NextResponse.json(
      { error: `Unexpected error: ${msg}` },
      { status: 500 },
    )
  }
}
