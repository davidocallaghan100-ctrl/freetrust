import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { developerHubUnavailable, jsonNoStore, readRateLimitPolicy, requireDeveloperOwner } from '@/lib/developer-api/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const createAppSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().nullable(),
}).strict()

export async function GET(request: NextRequest) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('developer_apps')
      .select('id, name, description, status, created_at, updated_at')
      .eq('owner_id', auth.user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Developer Hub] app list failed', { code: error.code })
      return developerHubUnavailable(error)
    }
    return jsonNoStore({ apps: data ?? [], limits: readRateLimitPolicy() })
  } catch {
    return developerHubUnavailable()
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonNoStore({ error: 'Request body must be valid JSON.' }, 400)
  }
  const parsed = createAppSchema.safeParse(body)
  if (!parsed.success) {
    return jsonNoStore({ error: 'Enter an app name (2–80 characters) and a description up to 500 characters.' }, 400)
  }

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('developer_apps')
      .insert({
        owner_id: auth.user.id,
        name: parsed.data.name,
        description: parsed.data.description || null,
      })
      .select('id, name, description, status, created_at, updated_at')
      .single()

    if (error || !data) {
      console.error('[Developer Hub] app create failed', { code: error?.code })
      return error ? developerHubUnavailable(error) : jsonNoStore({ error: 'Could not create the app.' }, 500)
    }
    return jsonNoStore({ app: data }, 201)
  } catch {
    return developerHubUnavailable()
  }
}
