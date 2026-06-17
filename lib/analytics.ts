'use client'

import { createClient } from '@/lib/supabase/client'

export type AnalyticsEventType =
  | 'profile_view'
  | 'service_view'
  | 'product_view'
  | 'post_view'
  | 'post_like'
  | 'post_comment'
  | 'post_share'
  | 'service_enquiry'
  | 'product_enquiry'
  | 'message_received'
  | 'follower_gained'
  | 'profile_search_appearance'

export type AnalyticsEntityType =
  | 'profile'
  | 'service'
  | 'product'
  | 'post'
  | 'message'
  | 'follower'
  | 'search'

export type TrackEventInput = {
  userId: string | null | undefined
  eventType: AnalyticsEventType
  entityType?: AnalyticsEntityType | null
  entityId?: string | null
  metadata?: Record<string, unknown> | null
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function trackEvent(input: TrackEventInput): Promise<string | null> {
  if (!isUuid(input.userId)) return null
  if (input.entityId && !isUuid(input.entityId)) return null

  try {
    const supabase = createClient()
    const { data, error } = await supabase.rpc('track_event', {
      p_user_id: input.userId,
      p_event_type: input.eventType,
      p_entity_type: input.entityType ?? null,
      p_entity_id: input.entityId ?? null,
      p_metadata: input.metadata ?? null,
    })
    if (error) return null
    return typeof data === 'string' ? data : null
  } catch {
    return null
  }
}

export function trackEventOnce(sessionKey: string, input: TrackEventInput): void {
  if (typeof window === 'undefined') return
  const key = `freetrust.analytics.${sessionKey}`
  try {
    if (window.sessionStorage.getItem(key)) return
    window.sessionStorage.setItem(key, '1')
  } catch {
    // If storage is blocked, still try the analytics write once for this render.
  }
  void trackEvent(input)
}
