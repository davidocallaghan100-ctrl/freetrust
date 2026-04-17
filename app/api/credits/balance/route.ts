import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ai_credits')
    .select('balance, lifetime_earned, lifetime_spent')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'balance_fetch_failed' }, { status: 500 });
  }

  return NextResponse.json({
    balance: data?.balance ?? 0,
    lifetime_earned: data?.lifetime_earned ?? 0,
    lifetime_spent: data?.lifetime_spent ?? 0,
  });
}
