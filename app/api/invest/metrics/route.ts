import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = createAdminClient();

  let members = 0;
  let listings = 0;
  let orders = 0;
  let trustInCirculation = 0;
  let founderBuyers = 0;
  let aiCreditsUsed = 0;

  try {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true });
    members = count ?? 0;
  } catch { /* table may not exist */ }

  try {
    const { count } = await admin.from('listings').select('id', { count: 'exact', head: true });
    listings = count ?? 0;
  } catch { /* table may not exist */ }

  try {
    const { count } = await admin.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'completed');
    orders = count ?? 0;
  } catch { /* table may not exist */ }

  try {
    const { data } = await admin.from('trust_balances').select('balance');
    if (data) {
      trustInCirculation = data.reduce((sum: number, row: { balance?: number | null }) => sum + (row.balance ?? 0), 0);
    }
  } catch { /* table may not exist */ }

  // TODO: founder_investments table does not exist yet — return 0 until the grant_founder_investment RPC creates it
  try {
    const { count } = await admin.from('founder_investments').select('id', { count: 'exact', head: true });
    founderBuyers = count ?? 0;
  } catch { /* table may not exist */ }

  // TODO: ai_credits table does not exist yet — return 0 until the AI credits system is fully wired
  try {
    const { data } = await admin.from('ai_credits').select('lifetime_spent');
    if (data) {
      aiCreditsUsed = data.reduce((sum: number, row: { lifetime_spent?: number | null }) => sum + (row.lifetime_spent ?? 0), 0);
    }
  } catch { /* table may not exist */ }

  return NextResponse.json({
    members,
    listings,
    orders,
    trustInCirculation,
    founderBuyers,
    aiCreditsUsed,
  });
}
