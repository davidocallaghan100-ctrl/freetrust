import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { isUuid } from '@/lib/developer-api/core'
import { developerHubUnavailable, jsonNoStore, requireDeveloperOwner } from '@/lib/developer-api/server'

export const dynamic = 'force-dynamic'

const updateAppSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field is required.')

export async function PATCH(
  request: NextRequest,
  { params }: { params: { appId: string } },
) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error
  if (!isUuid(params.appId)) return jsonNoStore({ error: 'App not found.' }, 404)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonNoStore({ error: 'Request body must be valid JSON.' }, 400)
  }
  const parsed = updateAppSchema.safeParse(body)
  if (!parsed.success) return jsonNoStore({ error: 'Provide a valid app name or description.' }, 400)

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('developer_apps')
      .update({ ...parsed.data, updated_at: new Date().toISOString() })
      .eq('id', params.appId)
      .eq('owner_id', auth.user.id)
      .select('id, name, description, status, created_at, updated_at')
      .maybeSingle()

    if (error) {
      console.error('[Developer Hub] app update failed', { code: error.code })
      return developerHubUnavailable(error)
    }
    if (!data) return jsonNoStore({ error: 'App not found.' }, 404)
    return jsonNoStore({ app: data })
  } catch {
    return developerHubUnavailable()
  }
}
