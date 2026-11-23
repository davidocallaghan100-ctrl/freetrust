import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { developerHubUnavailable, jsonNoStore, readRateLimitPolicy, requireDeveloperOwner } from '@/lib/developer-api/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const daysSchema = z.coerce.number().int().refine(value => [7, 30, 90].includes(value))

export async function GET(request: NextRequest) {
  const auth = await requireDeveloperOwner(request)
  if (auth.error) return auth.error

  const requestedDays = request.nextUrl.searchParams.get('days') ?? '7'
  const parsedDays = daysSchema.safeParse(requestedDays)
  if (!parsedDays.success) return jsonNoStore({ error: 'days must be 7, 30, or 90.' }, 400)

  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('developer_api_dashboard', {
      p_owner_id: auth.user.id,
      p_days: parsedDays.data,
      p_now: new Date().toISOString(),
    })
    if (error) {
      console.error('[Developer Hub] dashboard query failed', { code: error.code })
      return developerHubUnavailable(error)
    }
    return jsonNoStore({ dashboard: data, limits: readRateLimitPolicy() })
  } catch {
    return developerHubUnavailable()
  }
}
