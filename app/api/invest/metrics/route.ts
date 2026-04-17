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
  aiCreditsUsed: number;
};

async function safeCount(
  admin: ReturnType<typeof createAdminClient>,
  table: string,
): Promise<number> {
  try {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true });
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

  const members = await safeCount(admin, 'profiles');
  const listings = await safeCount(admin, 'listings');
  const orders = await safeCount(admin, 'orders');
  const founderBuyers = await safeCount(admin, 'founder_investments');

  // ₮ in circulation — sum of trust_balances.balance across all users
  let trustInCirculation = 0;
  try {
    const { data, error } = await admin.from('trust_balances').select('balance');
    if (!error && data) {
      trustInCirculation = data.reduce(
        (sum: number, row: { balance?: number | null }) => sum + (row.balance ?? 0),
        0
      );
    }
  } catch (err) {
    console.warn('metrics: trust_balances sum failed:', err);
  }

  // AI credits spent — sum of ai_credits.lifetime_spent
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

  const body: Metrics = {
    members,
    listings,
    orders,
    trustInCirculation,
    founderBuyers,
    aiCreditsUsed,
  };

  return NextResponse.json(body);
}
