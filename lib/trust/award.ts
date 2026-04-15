// ────────────────────────────────────────────────────────────────────────────
// awardTrust — non-blocking server-side helper for granting TrustCoins
// ────────────────────────────────────────────────────────────────────────────
//
// Wraps the issue_trust() SECURITY DEFINER RPC with three guarantees:
//
//   1. NEVER throws. A failure in the trust award must NOT block the
//      main action it's attached to — e.g. if the award fails after a
//      user creates a listing, the listing still gets created and the
//      user still sees success. Errors are logged to console with
//      enough context to diagnose.
//   2. Always uses the admin (service-role) client so RLS can't block
//      the path. The RPC is SECURITY DEFINER anyway, but using the
//      admin client is belt-and-braces.
//   3. Returns a structured result so callers can optionally surface
//      "You earned ₮X!" toast feedback without having to refetch the
//      wallet balance.
//
// Previously the codebase had ~10 call sites that each inlined their
// own `admin.rpc('issue_trust', {...})` with slightly different error
// handling. Several had silent catches that swallowed the failure,
// which is exactly how Cliff's missing-coins bug survived: the
// /api/create/publish service branch had no trust call AT ALL, and
// any fix would need to be duplicated across 5+ other creation
// paths that were also missing. This helper makes adding a trust
// award a one-line change that's impossible to get wrong.
//
// Usage:
//
//   import { awardTrust } from '@/lib/trust/award'
//   import { TRUST_REWARDS, TRUST_LEDGER_TYPES } from '@/lib/trust/rewards'
//
//   // Inside your POST handler, AFTER the main DB write has succeeded:
//   const trustResult = await awardTrust({
//     userId:  user.id,
//     amount:  TRUST_REWARDS.CREATE_SERVICE,
//     type:    TRUST_LEDGER_TYPES.CREATE_SERVICE,
//     ref:     inserted.id,
//     desc:    `Published service: ${title}`,
//   })
//   // trustResult.ok tells you whether it landed. Either way, return
//   // a success response to the client — the award is best-effort.
//   return NextResponse.json({ listing: inserted, trustAwarded: trustResult.amount })

import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_DAILY } from '@/lib/trust/rewards'

export interface AwardTrustInput {
  userId: string
  amount: number
  type:   string
  /** Optional reference id (e.g. the listing id this award is for) */
  ref?:   string | null
  /** Human-readable description — shown in the wallet history */
  desc:   string
}

export interface AwardTrustResult {
  /** True iff the RPC succeeded and the balance was updated */
  ok: boolean
  /** The amount that was awarded (0 on failure). Used by callers that
   *  want to echo "You earned ₮X" to the client — on failure we return
   *  0 so the UI doesn't lie to the user. */
  amount: number
  /** Error message from the RPC, if any. Never exposed to the client
   *  directly — logged to console for server-side debugging. */
  error: string | null
}

/**
 * Award TrustCoins to a user. Non-blocking — never throws, always
 * returns a result object. Logs failures to console with the full
 * PostgrestError including code, hint, and details.
 *
 * Internally uses the `issue_trust` Postgres RPC, which:
 *   * Inserts a row into trust_ledger
 *   * Upserts the user's trust_balances row (creating it if the user
 *     has never earned before — handles first-time earners)
 *   * Runs atomically in a single transaction
 *   * Runs as SECURITY DEFINER so it bypasses RLS on both tables
 *
 * The RPC was originally defined by supabase/migrations/20260413000004_
 * trust_welcome_grant.sql and reinforced by
 * supabase/migrations/20260414000007_trust_earning_infrastructure.sql
 * (the migration accompanying this helper).
 */
export async function awardTrust(input: AwardTrustInput): Promise<AwardTrustResult> {
  const { userId, amount, type, ref, desc } = input

  // Validate up front. A zero/negative award via the issue_trust RPC
  // would still succeed (the RPC accepts any integer) but would be
  // nonsense — catch it here so the caller can't accidentally write
  // a "You earned ₮0!" toast.
  if (!userId) {
    console.error('[awardTrust] missing userId', { type, amount })
    return { ok: false, amount: 0, error: 'missing userId' }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('[awardTrust] invalid amount', { userId, type, amount })
    return { ok: false, amount: 0, error: `invalid amount: ${amount}` }
  }
  if (!type) {
    console.error('[awardTrust] missing type', { userId, amount })
    return { ok: false, amount: 0, error: 'missing type' }
  }

  try {
    const admin = createAdminClient()

    // ── Daily earning cap (anti-abuse) ─────────────────────────────────
    // MAX_DAILY in lib/trust/rewards.ts defines a per-type, per-user,
    // per-UTC-day limit. Missing entries = no cap. Over-cap calls
    // return a non-blocking result so the route continues normally
    // (e.g. a 4th review still posts, it just doesn't earn ₮).
    const cap = MAX_DAILY[type as keyof typeof MAX_DAILY]
    if (typeof cap === 'number' && cap > 0) {
      const startOfDayIso = new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z'
      const { count, error: countErr } = await admin
        .from('trust_ledger')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type',    type)
        .gte('created_at', startOfDayIso)
      if (countErr) {
        console.warn('[awardTrust] daily cap precheck failed:', countErr.message)
        // Fall through — cap check failure is non-fatal, the award
        // still proceeds. Better to occasionally grant extra trust
        // than to silently drop every award on a DB hiccup.
      } else if ((count ?? 0) >= cap) {
        console.log(
          `[awardTrust] daily cap hit: user=${userId} type=${type} count=${count}/${cap} — skipped`
        )
        return { ok: false, amount: 0, error: 'daily_cap_reached' }
      }
    }

    const { error } = await admin.rpc('issue_trust', {
      p_user_id: userId,
      p_amount:  Math.floor(amount),
      p_type:    type,
      p_ref:     ref ?? null,
      p_desc:    desc,
    })

    if (error) {
      // Log the full PostgrestError so the next investigation has
      // actionable data instead of a one-line "failed" message.
      // This is a NON-blocking log — the calling route handler
      // continues to return success to the client.
      const e = error as { message?: string; code?: string; details?: string; hint?: string }
      console.error('[awardTrust] issue_trust RPC failed:', {
        userId,
        amount,
        type,
        ref: ref ?? null,
        message: e.message,
        code:    e.code,
        details: e.details,
        hint:    e.hint,
      })
      return { ok: false, amount: 0, error: e.message ?? 'unknown RPC error' }
    }

    // Success. Log a breadcrumb so Vercel logs show every successful
    // award — useful for auditing "did Cliff's listing award land?"
    // without hitting the DB.
    console.log(`[awardTrust] +₮${amount} → ${userId} (${type})${ref ? ` ref=${ref}` : ''}`)
    return { ok: true, amount: Math.floor(amount), error: null }
  } catch (err) {
    // createAdminClient() or the RPC call itself threw before we got
    // back a structured error. Still non-fatal — log and return.
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[awardTrust] threw:', { userId, amount, type, msg })
    return { ok: false, amount: 0, error: msg }
  }
}
