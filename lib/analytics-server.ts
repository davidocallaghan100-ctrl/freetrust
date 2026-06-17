import { createAdminClient } from '@/lib/supabase/admin'
import type { AnalyticsEntityType, AnalyticsEventType } from '@/lib/analytics'

type ServerAnalyticsInput = {
  userId: string | null | undefined
  actorId?: string | null
  eventType: AnalyticsEventType
  entityType?: AnalyticsEntityType | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function recordAnalyticsEvent(input: ServerAnalyticsInput): Promise<string | null> {
  if (!isUuid(input.userId)) return null
  if (input.actorId && !isUuid(input.actorId)) return null
  if (input.entityId && !isUuid(input.entityId)) return null

  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('analytics_events')
      .insert({
        user_id: input.userId,
        actor_id: input.actorId ?? null,
        event_type: input.eventType,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
        metadata: input.metadata ?? null,
      })
      .select('id')
      .single()

    if (error) return null
    return typeof data?.id === 'string' ? data.id : null
  } catch {
    return null
  }
}
