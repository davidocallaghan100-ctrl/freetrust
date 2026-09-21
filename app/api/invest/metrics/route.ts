import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Metrics = {
  members: number;
  listings: number;
  orders: number;
  trustInCirculation: number;
  founderBuyers: number;
  aiAgentRuns: number;
  aiCreditsUsed: number;
  walletTransactions: number;
};

async function safeCount(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
): Promise<number> {
  try {
    // A few legacy tables (including founder_investments) do not expose an
    // `id` column. Counting `*` keeps this helper schema-agnostic.
    const { count, error } = await admin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.warn(`metrics: failed to count ${table}:`, error.message);
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    console.warn(`metrics: exception counting ${table}:`, err);
    return 0;
  }
}

export async function GET() {
  const admin = createAdminClient();

  // Traction counts active real members. Soft-deleted rows and the known
  // Adaptive test account are excluded, but a genuine member is not removed
  // from the business total merely because they have not finished onboarding.
  let publicMemberIds = new Set<string>();
  try {
    const { data, error } = await admin
      .from('profiles')
      .select('id, email, deleted_at');
    if (error) {
      console.warn('metrics: failed to load public profiles:', error.message);
    } else {
      publicMemberIds = new Set(
        (data ?? [])
          .filter((profile) =>
            !profile.deleted_at &&
            !(typeof profile.email === 'string' && profile.email.toLowerCase().endsWith('@adaptivetest.local'))
          )
          .map((profile) => profile.id as string)
      );
    }
  } catch (err) {
    console.warn('metrics: exception loading public profiles:', err);
  }

  const members = publicMemberIds.size;

  // Only live community listings belong in investor traction. External
  // retailer/provider catalogue rows are a separate marketplace surface.
  let listings = 0;
  try {
    const { count, error } = await admin
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    if (error) console.warn('metrics: failed to count active listings:', error.message);
    listings = count ?? 0;
  } catch (err) {
    console.warn('metrics: exception counting active listings:', err);
  }

  // The traction slide says “completed”, so do not count pending/cancelled
  // order rows in this metric.
  let orders = 0;
  try {
    const { count, error } = await admin
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .in('status', ['completed', 'delivered']);
    if (error) console.warn('metrics: failed to count completed orders:', error.message);
    orders = count ?? 0;
  } catch (err) {
    console.warn('metrics: exception counting completed orders:', err);
  }

  // Count distinct paid members rather than investment rows. The legacy table
  // has changed shape over time, so support its known buyer-key variants.
  let founderBuyers = 0;
  try {
    const { data, error } = await admin.from('founder_investments').select('*');
    if (error) {
      console.warn('metrics: failed to load founder investments:', error.message);
    } else {
      const buyerIds = (data ?? [])
        .map((row: Record<string, unknown>) => row.user_id ?? row.buyer_id ?? row.member_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      founderBuyers = buyerIds.length > 0 ? new Set(buyerIds).size : (data?.length ?? 0);
    }
  } catch (err) {
    console.warn('metrics: exception loading founder investments:', err);
  }

  // ₮ in circulation — sum of trust_balances.balance across all users
  let trustInCirculation = 0;
  try {
    const { data, error } = await admin.from('trust_balances').select('user_id, balance');
    if (!error && data) {
      trustInCirculation = data.reduce(
        (sum: number, row: { user_id?: string; balance?: number | null }) =>
          publicMemberIds.has(row.user_id ?? '') ? sum + (row.balance ?? 0) : sum,
        0
      );
    }
  } catch (err) {
    console.warn('metrics: trust_balances sum failed:', err);
  }

  // AI agent runs are recorded as Trust ledger debits. `ai_credits` is a
  // separate purchased-credit balance and must not be presented as agent-run
  // count (it was previously the source of a misleading zero on this slide).
  let aiAgentRuns = 0;
  try {
    const { data, error } = await admin.from('trust_ledger').select('type').neq('type', 'test_seed');
    if (!error && data) {
      aiAgentRuns = data.filter((row: { type?: string | null }) => {
        const type = row.type ?? '';
        return type.startsWith('agent_') && !type.startsWith('agent_refund_');
      }).length;
    }
  } catch (err) {
    console.warn('metrics: agent run count failed:', err);
  }

  // Keep the purchased AI-credit total available for API consumers that still
  // use it, but expose it separately from actual agent-run count.
  let aiCreditsUsed = 0;
  try {
    const { data, error } = await admin.from('ai_credits').select('lifetime_spent');
    if (!error && data) {
      aiCreditsUsed = data.reduce(
        (sum: number, row: { lifetime_spent?: number | null }) => sum + (row.lifetime_spent ?? 0),
        0
      );
    }
  } catch (err) {
    console.warn('metrics: ai_credits sum failed:', err);
  }

  // Unified wallet activity: Trust ledger entries, completed fiat top-ups,
  // completed member transfers, and completed orders. The test seed is
  // intentionally excluded from public traction while it remains in the
  // historical database pending explicit cleanup approval.
  let walletTransactions = 0;
  try {
    const [ledgerRes, depositsRes, transfersRes] = await Promise.all([
      admin.from('trust_ledger').select('*', { count: 'exact', head: true }).neq('type', 'test_seed'),
      admin.from('money_deposits').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
      admin.from('wallet_transfers').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    ]);
    walletTransactions =
      (ledgerRes.count ?? 0) +
      (depositsRes.count ?? 0) +
      (transfersRes.count ?? 0) +
      orders;
  } catch (err) {
    console.warn('metrics: wallet transaction count failed:', err);
  }

  const body: Metrics = {
    members,
    listings,
    orders,
    trustInCirculation,
    founderBuyers,
    aiAgentRuns,
    aiCreditsUsed,
    walletTransactions,
  };

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}
