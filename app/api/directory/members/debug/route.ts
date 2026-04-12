export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/directory/members/debug
//
// Dedicated diagnostic endpoint for "new members not showing" bugs. Returns
// raw counts and recent rows from BOTH auth.users and public.profiles so
// you can see exactly where the discrepancy is without SSH'ing into Vercel
// logs or hitting the Supabase SQL editor.
//
// Response shape:
// {
//   env: { has_url: bool, has_service_role_key: bool },
//   auth_users: { count: number, pages: number, recent: [{id, email, created_at}] },
//   profiles:   { count: number, recent: [{id, email, full_name, created_at}] },
//   missing:    { count: number, ids: string[] },
//   error:      null | string,
// }
//
// Hit this from your browser while logged in:
//   curl https://freetrust.co/api/directory/members/debug
export async function GET() {
  const out: Record<string, unknown> = {
    env: {
      has_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      has_service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    auth_users: { count: 0, pages: 0, recent: [] },
    profiles:   { count: 0, recent: [] },
    missing:    { count: 0, ids: [] as string[] },
    error: null,
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    out.error = 'SUPABASE_SERVICE_ROLE_KEY is not set in the environment. The backfill path cannot work without it.'
    return NextResponse.json(out, { status: 500, headers: noStoreHeaders() })
  }

  try {
    const admin = createAdminClient()

    // ── 1. Page through every auth.users record ─────────────────────────────
    const allAuth: Array<{ id: string; email: string | null; created_at: string }> = []
    const PER = 1000
    const MAX_PAGES = 20
    let pagesFetched = 0
    for (let p = 1; p <= MAX_PAGES; p++) {
      const { data, error } = await admin.auth.admin.listUsers({ page: p, perPage: PER })
      if (error) {
        out.error = `listUsers page=${p} failed: ${error.message}`
        break
      }
      const users = data?.users ?? []
      pagesFetched = p
      if (users.length === 0) break
      for (const u of users) {
        allAuth.push({
          id: u.id,
          email: u.email ?? null,
          created_at: (u.created_at as string) ?? '',
        })
      }
      if (users.length < PER) break
    }
    allAuth.sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    out.auth_users = {
      count: allAuth.length,
      pages: pagesFetched,
      recent: allAuth.slice(0, 10),
    }

    // ── 2. Fetch profiles (newest 10 + count) ───────────────────────────────
    const { data: profilesRecent, error: profilesErr } = await admin
      .from('profiles')
      .select('id, email, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    if (profilesErr) {
      out.error = `profiles query failed: ${profilesErr.message}`
      return NextResponse.json(out, { status: 500, headers: noStoreHeaders() })
    }

    const { count: profilesCount, error: countErr } = await admin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
    if (countErr) {
      out.error = `profiles count failed: ${countErr.message}`
    }

    out.profiles = {
      count: profilesCount ?? 0,
      recent: profilesRecent ?? [],
    }

    // ── 3. Find the delta: auth users with no profile row ───────────────────
    const authIds = allAuth.map(u => u.id)
    if (authIds.length > 0) {
      const existingIds = new Set<string>()
      const CHUNK = 500
      for (let i = 0; i < authIds.length; i += CHUNK) {
        const { data } = await admin
          .from('profiles')
          .select('id')
          .in('id', authIds.slice(i, i + CHUNK))
        for (const row of data ?? []) existingIds.add((row as { id: string }).id)
      }
      const missingIds = authIds.filter(id => !existingIds.has(id))
      out.missing = {
        count: missingIds.length,
        ids: missingIds.slice(0, 20), // first 20 so we don't blow up the response
      }
    }

    return NextResponse.json(out, { headers: noStoreHeaders() })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    out.error = `unhandled: ${msg}`
    return NextResponse.json(out, { status: 500, headers: noStoreHeaders() })
  }
}

function noStoreHeaders() {
  return {
    'Cache-Control': 'no-store, max-age=0, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  }
}
