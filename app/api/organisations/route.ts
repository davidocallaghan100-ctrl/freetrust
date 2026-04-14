export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  computeOrgTrustScore,
  collectTrustSignalsForOrgs,
} from '@/lib/organisations/trust-score'
import { toPgTagArray } from '@/lib/supabase/text-array'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const sector = searchParams.get('sector')
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)

    let query = supabase
      .from('organisations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) query = query.eq('type', type)
    if (sector) query = query.eq('sector', sector)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ organisations: [] })
    }

    // Replace the static `trust_score` column with a value calculated
    // from real signals (reviews, members, followers, profile completeness,
    // verified, age). Without this the column is binary-ish (0 for newly
    // created orgs, 100 for any org someone manually edited) — see
    // lib/organisations/trust-score.ts for the formula.
    //
    // DEFENSIVE FALLBACK:
    // The compute step is wrapped in its own try/catch so a failure in
    // the batched helper queries (missing table, RLS denial, Supabase
    // 503, whatever) silently degrades to the raw `trust_score` column
    // value instead of 500-ing the whole endpoint. Log to console.error
    // so the failure is visible in Vercel logs without being user-facing.
    const rawOrgs = (data ?? []) as Array<Record<string, unknown> & { id: string }>
    try {
      const signalsMap = await collectTrustSignalsForOrgs(supabase, rawOrgs)
      const organisations = rawOrgs.map(o => {
        const sig = signalsMap.get(o.id)
        const computed = sig ? computeOrgTrustScore(sig) : null
        return {
          ...o,
          // If we got a signal row back we use the computed value;
          // otherwise fall back to whatever the DB column held (or 0).
          trust_score: computed ?? (typeof o.trust_score === 'number' ? o.trust_score : 0),
        }
      })
      return NextResponse.json({ organisations })
    } catch (scoreErr) {
      const msg = scoreErr instanceof Error ? scoreErr.message : String(scoreErr)
      console.error('[GET /api/organisations] trust_score compute failed, falling back to raw column:', msg)
      return NextResponse.json({ organisations: rawOrgs })
    }
  } catch (err) {
    console.error('[GET /api/organisations]', err)
    return NextResponse.json({ organisations: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, slug, type, description, location, website, sector, tags, logo_url } = body

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }
    if (!type) {
      return NextResponse.json({ error: 'Organisation type is required' }, { status: 400 })
    }
    if (!description?.trim() || description.trim().length < 20) {
      return NextResponse.json({ error: 'Description must be at least 20 characters' }, { status: 400 })
    }

    // Normalise website — accept "www.example.com" without https://
    let normWebsite: string | null = null
    if (website?.trim()) {
      const w = website.trim()
      normWebsite = /^https?:\/\//i.test(w) ? w : `https://${w}`
    }

    // Generate a unique slug — auto-append -2, -3 etc if taken
    const admin = createAdminClient()
    const baseSlug = (slug || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 55)
    let orgSlug = baseSlug
    let attempt = 1
    while (true) {
      const { data: existing } = await admin
        .from('organisations')
        .select('id')
        .eq('slug', orgSlug)
        .maybeSingle()
      if (!existing) break
      attempt++
      orgSlug = `${baseSlug}-${attempt}`
    }

    // Seed trust_score with the BASE value from computeOrgTrustScore
    // (25, see lib/organisations/trust-score.ts). The list endpoint
    // always overrides this with a live signal computation, and the
    // detail endpoint now does too (app/api/organisations/[id]/route.ts),
    // so the DB column is effectively just a fallback — but seeding it
    // with 25 instead of 0 means even if the compute path fails for
    // any reason, new orgs never show a misleading ₮0 in the UI.
    const { data: org, error: insertError } = await admin
      .from('organisations')
      .insert({
        creator_id: user.id,
        name: name.trim(),
        slug: orgSlug,
        type,
        description: description.trim(),
        location: location?.trim() || null,
        website: normWebsite,
        sector: sector || null,
        // Encode tags as a Postgres text[] literal to work around the
        // PostgREST JSON→text[] coercion bug. Same pattern as the
        // listings + grassroots fixes.
        tags: toPgTagArray(tags),
        logo_url: logo_url || null,
        is_verified: false,
        members_count: 1,
        trust_score: 25,
        status: 'active',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[POST /api/organisations] insert error:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Belt-and-braces owner membership row. The 20260414000001
    // migration installs a DB trigger (handle_new_organisation) that
    // inserts this row automatically, but we also do it explicitly
    // here so the app works in environments that haven't run the
    // migration yet (local dev, a fresh branch deploy, etc.). The
    // trigger uses ON CONFLICT DO NOTHING and this insert uses the
    // same, so there's no double-insert risk if both fire.
    try {
      const { error: memberErr } = await admin
        .from('organisation_members')
        .insert({
          organisation_id: org.id,
          user_id: user.id,
          role: 'owner',
          title: 'Founder',
          joined_at: new Date().toISOString(),
        })
      if (memberErr && !/duplicate|conflict/i.test(memberErr.message)) {
        // Duplicates are expected (the trigger already ran) — log
        // anything else as a warning. Not fatal to the response.
        console.warn('[POST /api/organisations] owner membership row not created:', memberErr.message)
      }
    } catch (memberErr) {
      const msg = memberErr instanceof Error ? memberErr.message : String(memberErr)
      console.warn('[POST /api/organisations] owner membership insert threw:', msg)
    }

    return NextResponse.json({ organisation: org, created: true }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organisations]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
