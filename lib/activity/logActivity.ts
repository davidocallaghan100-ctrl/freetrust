import { createClient } from '@supabase/supabase-js'

// Uses service role to bypass RLS — this is a server-only helper
// Never import this in client components
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ActivityEventType =
  | 'order_placed'
  | 'payment_confirmed'
  | 'seller_accepted'
  | 'delivery_started'
  | 'delivery_completed'
  | 'buyer_confirmed'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'review_left'
  | 'message_sent'
  | 'status_changed'
  | 'location_update'

export interface LogActivityParams {
  orderId: string
  actorId?: string
  actorRole: 'buyer' | 'seller' | 'system'
  eventType: ActivityEventType
  title: string
  body?: string
  metadata?: Record<string, unknown>
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  const { error } = await supabaseAdmin.from('order_activity').insert({
    order_id:   params.orderId,
    actor_id:   params.actorId ?? null,
    actor_role: params.actorRole,
    event_type: params.eventType,
    title:      params.title,
    body:       params.body ?? null,
    metadata:   params.metadata ?? {},
  })
  if (error) {
    console.error('[logActivity] failed:', error.message)
  }
}
