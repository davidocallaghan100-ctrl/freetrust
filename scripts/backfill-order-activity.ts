/**
 * Backfill script: inserts an `order_placed` activity event for every existing order
 * so the activity feed shows at least one entry for historical orders.
 *
 * Run once after applying the 20260421000001_order_activity_feed migration:
 *   npx tsx scripts/backfill-order-activity.ts
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://tioqakxnqjxyuzgnwhrb.supabase.co',
  // Service role key — bypasses RLS for server-side backfill
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpb3Fha3hucWp4eXV6Z253aHJiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTUwNzc5OCwiZXhwIjoyMDkxMDgzNzk4fQ.gn5-rMINbSUKJEiNa733DIG8QK68jb7lUg0OPIz8efg'
)

async function backfill() {
  console.log('Fetching all orders...')
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, buyer_id, seller_id, status, created_at, item_title')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch orders:', error.message)
    process.exit(1)
  }
  if (!orders || orders.length === 0) {
    console.log('No orders found.')
    return
  }

  console.log(`Backfilling ${orders.length} orders...`)
  let inserted = 0
  let skipped = 0

  for (const order of orders) {
    // Check if activity already exists for this order (idempotent)
    const { count } = await supabase
      .from('order_activity')
      .select('id', { count: 'exact', head: true })
      .eq('order_id', order.id)

    if ((count ?? 0) > 0) {
      skipped++
      continue
    }

    const { error: insertErr } = await supabase.from('order_activity').insert({
      order_id:   order.id,
      actor_id:   order.buyer_id,
      actor_role: 'buyer',
      event_type: 'order_placed',
      title:      'Order placed',
      body:       order.item_title ? `"${order.item_title}"` : null,
      metadata:   {},
      created_at: order.created_at,
    })

    if (insertErr) {
      console.error(`  ✗ order ${order.id}:`, insertErr.message)
    } else {
      inserted++
      if (inserted % 10 === 0) process.stdout.write(`  ${inserted} inserted...\r`)
    }
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped (already had activity): ${skipped}`)
}

backfill()
