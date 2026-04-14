export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ────────────────────────────────────────────────────────────────────────────
// GET /api/events/eventbrite-org
// ────────────────────────────────────────────────────────────────────────────
//
// One-shot helper to find the Eventbrite organisation ID you need to
// configure as EVENTBRITE_ORG_ID on Vercel. Calls Eventbrite's
// /v3/users/me/organizations/ endpoint with the token configured as
// EVENTBRITE_PRIVATE_TOKEN and returns the list of organisations the
// token has access to.
//
// Admin-only — gated on profiles.role === 'admin' (the existing
// pattern across /admin, /services, /products, etc.).
//
// Usage:
//   1. Set EVENTBRITE_PRIVATE_TOKEN in Vercel env vars + redeploy
//   2. Log in as an admin user
//   3. curl https://freetrust.co/api/events/eventbrite-org \
//        -H "Cookie: <your session cookie>"
//      OR visit the URL in a logged-in browser tab
//   4. Copy the organisation id from the response
//   5. Set EVENTBRITE_ORG_ID in Vercel env vars to that value + redeploy
//   6. Hit /api/events/sync-eventbrite (or the Sync button on /events)
//
// This endpoint can be deleted once you have the org id — it's a
// bootstrap helper, not a long-term API. Kept in the repo for
// documentation value and in case the org id ever changes.

interface EventbriteOrganization {
  id: string
  name: string
  vertical?: string
  image_id?: string | null
  _type?: string
}

interface EventbriteOrgsResponse {
  organizations?: EventbriteOrganization[]
  pagination?: {
    page_number?: number
    page_count?: number
    page_size?: number
    object_count?: number
    has_more_items?: boolean
  }
  error?: string
  error_description?: string
}

export async function GET() {
  try {
    // ── Auth: admin only ────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
    }

    // ── Env check ───────────────────────────────────────────────────────
    const token = process.env.EVENTBRITE_PRIVATE_TOKEN
    if (!token) {
      return NextResponse.json(
        {
          error: 'EVENTBRITE_PRIVATE_TOKEN is not set in the environment.',
          hint: 'Add it to Vercel → Project Settings → Environment Variables and redeploy.',
        },
        { status: 500 },
      )
    }

    // ── Fetch from Eventbrite ───────────────────────────────────────────
    const res = await fetch('https://www.eventbriteapi.com/v3/users/me/organizations/', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
      // Eventbrite caches aggressively at the CDN — this is a tiny
      // payload, just bypass cache to avoid stale data during setup.
      cache: 'no-store',
    })

    const body = (await res.json().catch(() => ({}))) as EventbriteOrgsResponse

    if (!res.ok) {
      console.error('[eventbrite-org] Eventbrite API error:', res.status, body)
      return NextResponse.json(
        {
          error: `Eventbrite API returned ${res.status} ${res.statusText}`,
          detail: body.error_description ?? body.error ?? body,
        },
        { status: 502 },
      )
    }

    const orgs = body.organizations ?? []
    if (orgs.length === 0) {
      return NextResponse.json(
        {
          organizations: [],
          hint:
            'The Eventbrite account associated with EVENTBRITE_PRIVATE_TOKEN has no organisations. ' +
            'Create one at https://www.eventbrite.com/organizations/ or check the token scope.',
        },
      )
    }

    return NextResponse.json({
      organizations: orgs.map(o => ({
        id: o.id,
        name: o.name,
        vertical: o.vertical ?? null,
      })),
      next_step:
        orgs.length === 1
          ? `Copy this id and set EVENTBRITE_ORG_ID=${orgs[0].id} in Vercel env vars, then redeploy.`
          : 'Multiple organisations — pick the one you want and copy its id into EVENTBRITE_ORG_ID on Vercel.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[eventbrite-org] unexpected error:', message, err)
    return NextResponse.json(
      { error: `Unexpected error: ${message}` },
      { status: 500 },
    )
  }
}
