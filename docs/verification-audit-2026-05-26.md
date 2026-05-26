# FreeTrust verification, transaction-auth, and trust-badge audit

Date: 2026-05-26  
Scope: Phase 1 read-only audit only. No migrations were applied and no app code was changed for this report.

## Executive summary

FreeTrust now has the first layer of profile-verification fields in production and the main profile/directory/feed surfaces mostly key the formal profile badge to explicit verification state. However, the current system still has three trust-signal risks that should be fixed before public claims around “verified members” are expanded:

1. **Verification grant fields are protected in the server profile route but not defensibly protected at the database boundary.** The public `profiles` RLS policy still allows a user to update their own row generally, which means columns such as `is_verified`, `verified_at`, and `verification_status` need database-level hardening before they can be treated as fraud-resistant.
2. **Trust Coin balance labels are still confused with identity verification.** Multiple UI surfaces call a balance-derived tier “Verified Member” at ₮500 even though production has `0` actually verified profiles and all `39` visible profiles are currently `verification_status='unverified'`.
3. **Transaction authentication is session-only today.** Checkout, Trust Coin spends, impact donations, and wallet transfers require a logged-in session, but there is no step-up passkey/WebAuthn confirmation for sensitive or high-value actions yet.

Recommended direction: separate **identity verification** from **contribution/reputation tiers**, add database-side immutable controls/audit trail for verification grants, introduce Stripe Identity as the reviewed verification evidence source, and add WebAuthn/passkey step-up for sensitive transactions.

---

## 1.1 Current schema state

### Production profile-verification columns

The production `profiles` table includes the basic additive verification/professional columns from `supabase/migrations/20260526000001_profile_verification_professional.sql`:

- `is_verified boolean not null default false`
- `verified_at timestamptz`
- `verified_by uuid references public.profiles(id)`
- `verification_status text not null default 'unverified'`
- `verification_submitted_at timestamptz`
- `verification_details jsonb not null default '{}'::jsonb`
- `professional_headline text`
- `professional_experience jsonb not null default '[]'::jsonb`

Indexes present from that migration:

- `idx_profiles_is_verified` filtered where `is_verified=true`
- `idx_profiles_verification_status`

Production read-only counts captured during this audit:

- `profiles`: `39`
- `visible_profiles`: `39`
- `verified_profiles`: `0`
- `verification_status_counts`: `{ "unverified": 39 }`
- `trust_balance_gte_100_unverified`: `39`

Interpretation: every current visible profile is unverified by the new identity-verification fields, while every current profile has enough Trust balance to qualify for at least the older balance-derived “Trusted Member” tier.

### Pending fuller migration, not applied

`supabase/migrations/20260526093000_profile_verification_experience.sql` exists but was not applied during this audit. It proposes:

- enum `public.profile_verification_status` with values `unverified`, `submitted`, `verified`, `rejected`.
- extra review fields:
  - `verification_method`
  - `verification_verified_at`
  - `verification_rejected_at`
  - `verification_reviewed_by`
  - `verification_notes`
- a `profile_experiences` table with public-read RLS and owner manage RLS.

Important caveat: this pending migration improves status typing and experience modeling, but by itself it does **not** fully solve database-level protection for verification grant columns on `profiles`. The existing broad owner-update policy still needs to be constrained or guarded before `is_verified` / `verified_at` / `verification_status='verified'` can be considered defensible.

### RLS and policy observations

Relevant production RLS/policies from the read-only schema query:

- `profiles` has public SELECT: `Profiles are viewable by everyone` using `true`.
- `profiles` has owner UPDATE: `Users can update own profile` using `(auth.uid() = id)`.
- `trust_balances` is publicly readable and has owner insert/update policies.
- `trust_ledger` is owner-readable and owner-insertable.
- `issue_trust`, `spend_trust`, and `donate_to_impact_fund` are `SECURITY DEFINER` routines.
- `orders`, `money_deposits`, `wallet_transfers`, `impact_*` tables have RLS enabled in production metadata.

Risk note: the server route `app/api/profile/route.ts` correctly whitelists editable fields and deliberately excludes `is_verified`, `verified_at`, and `verified_by`. But RLS applies to any client using the Supabase anon/authenticated client too; the broad owner-update policy does not appear to prevent a direct authenticated update of the user’s own verification columns. This should be fixed in the database, not only in the Next.js route.

### Orders schema note

`lib/supabase/orders-schema.sql` contains an old/reference-looking policy:

```sql
create policy "Service role manage" on orders
  for all using (true);
```

That file’s table shape does not match the current production `orders` columns exactly, and production policy output captured in the read-only query did not show the same `orders` policy snippet in the visible policy list. Treat this file as historical/reference until confirmed otherwise. If reused in a future migration, the service-role policy must be changed to `auth.role() = 'service_role'` in both `USING` and `WITH CHECK`.

---

## 1.2 Current transaction and discovery flow

### Profile verification flow today

Current user-facing flow:

- `components/profile/ProfilePage.tsx` lets the owner submit professional headline, professional experience, and a verification note.
- `app/api/profile/route.ts` accepts `verification_details` and, when a non-empty note is submitted by an unverified profile, sets:
  - `verification_status='submitted'`
  - `verification_submitted_at=now()`
  - `verification_details.note`, `submitted_via`, `updated_at`
- `app/api/profile/verification/route.ts` is a second submission endpoint that also sets `verification_status='submitted'` and stores details.

Current badge logic:

- `components/profile/ProfilePage.tsx` treats a profile as verified when `is_verified || verified_at || verification_status === 'verified'`.
- `app/members/page.tsx` uses the same effective logic for directory cards.
- `components/PostCard.tsx` receives `is_verified`, `verified_at`, and `verification_status` from feed profile joins and displays author verification indicators.
- `components/profile/VerifiedBadge.tsx` is stricter and returns a badge only when `status === 'verified'`, but it is not the only badge implementation in use.

Good current behavior: submitting a verification request does not, through the approved server routes, self-grant a public verified badge.

Gap: there is no admin review workflow, no immutable audit table, no Stripe Identity session/status table, and no database trigger/constraint preventing direct self-update of verification grant fields.

### Trust Coin / trust-tier flow today

Trust balance mutations are mostly routed through existing RPCs:

- `issue_trust` for awards/refunds/debits in many server paths.
- `spend_trust` for spend actions in `app/api/trust/spend/route.ts`.
- `donate_to_impact_fund` for impact donations in `app/api/impact/donate/route.ts`.

This is good because the main balance-changing code paths are centralized, transactional, and use `SECURITY DEFINER` routines.

However, trust-balance labels are currently presented in ways that can be mistaken for identity verification:

- `components/profile/ProfilePage.tsx`:
  - ₮100+ => `Trusted Member`
  - ₮500+ => `Verified Member`
  - ₮1000+ => `Community Leader`
  - ₮5000+ => `FreeTrust Ambassador`
- `app/wallet/page.tsx` mirrors the same `Verified Member` label at ₮500.
- `app/api/assistant/chat/route.ts` says `₮500 = Verified Pro`.
- `app/browse/page.tsx` marks a member `✓ Verified` based only on profile completeness: avatar + bio + location.
- Other legacy/collab surfaces use score-derived “Verified” labels as well.

This is the primary trust-signal mismatch: “verified” is used both for formal identity/profile review and for contribution/profile-completeness tiers.

### Transaction flow today

Session guards are present on sensitive endpoints reviewed in this audit:

- `app/api/checkout/route.ts`: requires logged-in session to initiate generic Stripe checkout.
- `app/api/checkout/product/route.ts`: requires logged-in session, rejects self-purchase, verifies listing availability and server-side price.
- `app/api/checkout/service/route.ts`: requires logged-in session, rejects self-purchase, verifies listing availability and server-side price.
- `app/api/stripe/topup/route.ts`: requires logged-in session for wallet top-up checkout.
- `app/api/trust/spend/route.ts`: requires logged-in session and uses server-side spend-action pricing.
- `app/api/impact/donate/route.ts`: requires logged-in session and atomically debits via RPC.
- `app/api/wallet/transfer/route.ts`: requires logged-in session, validates recipient/self-transfer, and records completed transfers.

Not present today:

- WebAuthn/passkey credential tables.
- SimpleWebAuthn dependencies (`@simplewebauthn/server` / `@simplewebauthn/browser` are not installed).
- Step-up challenge/verification for Trust Coin spends, wallet transfers, donations, or order release/dispute actions.

### Discovery flow today

- `/api/directory/members` is built from `public.profiles` only, filtered by `.is('deleted_at', null)`, and does not create profiles as a side effect. This is good and avoids resurrecting deleted users.
- It returns all visible profiles up to 1000 rows, then enriches with trust balances and follower counts.
- `/members` category filtering currently returns `true` for members with no bio, so empty profiles can appear in every category.
- `/browse` has an older completeness-derived “Verified” concept that should be removed or renamed.

---

## 1.3 Gap analysis

### High priority

1. **Database-level self-verification gap**
   - Current route-level whitelist is good but insufficient.
   - The `profiles` owner-update RLS policy appears broad enough that direct Supabase client calls could update verification grant fields on the owner’s row.
   - Required before public launch of personal verification: database-level prevention of user-controlled updates to `is_verified`, `verified_at`, `verified_by`, `verification_status='verified'`, and review metadata.

2. **No verification audit trail**
   - Current schema stores a mutable status/details blob on `profiles`.
   - There is no append-only `profile_verifications` / review-events table recording who reviewed, which provider/session was used, the result, and timestamps.

3. **“Verified Member” label collision**
   - Formal identity verification and Trust Coin reputation are mixed in copy/UI.
   - With `0` verified production profiles, showing balance-derived “Verified Member” can mislead users.

4. **No transaction step-up auth**
   - Logged-in session is the only check for transfer/spend/donation/order actions.
   - A stolen session can initiate sensitive actions without a second local-device proof.

### Medium priority

5. **Discovery includes low-signal profiles**
   - `/members` returns all non-deleted profiles and category filters include no-bio profiles in every category.
   - This is good for freshness but weak for trusted discovery. It makes incomplete accounts more visible than intended.

6. **Inconsistent badge implementations**
   - `ProfilePage` has an inline `VerifiedBadge`; `components/profile/VerifiedBadge.tsx` has a stricter reusable badge keyed only to `status === 'verified'`.
   - Multiple older pages independently render “Verified” from different signals.

7. **Pending migration is not enough by itself**
   - The pending enum/experience migration is directionally useful, but should be revised before applying so it includes DB-level verification controls and audit tables, or is paired with a separate hardening migration.

### Lower priority / cleanup

8. **Historical orders schema policy**
   - `lib/supabase/orders-schema.sql` has a broad `for all using (true)` service policy in the file. If this is not production-active, leave it alone for now; if it becomes migration source material, harden it first.

9. **Provider/version readiness**
   - Stripe is already installed (`stripe ^22.0.0`, `@stripe/stripe-js ^9.1.0`) and production env has `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`.
   - SimpleWebAuthn is not installed; latest observed package versions are `13.3.0` for both server and browser packages.

---

## 1.4 Recommendations

### Recommendation A — define trust vocabulary before code changes

Use separate terms consistently:

- **Verified profile**: identity/profile review passed. Only this gets the formal checkmark badge.
- **Trust tier**: contribution/reputation tier based on Trust Coin balance and activity. Do not use “Verified” as a tier name.

Recommended tier copy:

| Tier | Suggested requirement | Public meaning |
| --- | --- | --- |
| New Member | Default / below ₮100 | New or low-activity account |
| Trusted Member | ₮100+ | Some platform activity/reputation |
| Established Member | ₮500+ | Sustained contribution/reputation |
| Community Leader | ₮1000+ | High contribution/reputation |
| FreeTrust Ambassador | ₮5000+ | Highest contribution/reputation |

If David wants the exact proposed four-tier set (`New Member`, `Verified Member`, `Trusted Member`, `Established Member`), I recommend changing “Verified Member” to “Active Member” or reserving “Verified” strictly for identity verification. If “Verified Member” must remain, it should be backed by identity verification, not balance alone.

### Recommendation B — harden profile verification before any backfill

Before applying the pending fuller migration or granting badges:

1. Add an append-only audit table, e.g. `profile_verification_reviews` or `profile_verifications`, with:
   - `id`
   - `profile_id`
   - `provider` (`manual`, `stripe_identity`, later others)
   - `provider_session_id` / `provider_verification_report_id` nullable
   - `status` (`submitted`, `verified`, `rejected`, `requires_input`)
   - `reviewed_by`
   - `reviewed_at`
   - `created_at`
   - non-sensitive `reason_code` / `notes`
2. Add database-side protection so user-authenticated updates cannot grant or alter approved verification fields. Options:
   - Move approved verification state into a separate table with no public UPDATE policy.
   - Or add a trigger on `profiles` that rejects changes to verification grant columns unless `auth.role() = 'service_role'` or a controlled server-side setting is present.
   - Or revoke/update policies and route all profile edits through controlled server endpoints/RPCs with explicit column-level logic.
3. Keep user-submitted evidence non-sensitive. Do not store ID document images or biometric data in Supabase.

### Recommendation C — integrate Stripe Identity as the verification evidence source

Use Stripe Identity for formal person verification because Stripe already has keys configured and is already the payment provider.

Suggested flow:

1. User clicks “Verify profile”.
2. Server creates a Stripe Identity Verification Session.
3. Store only the Stripe session ID, profile ID, status, and timestamps locally.
4. Stripe hosts the sensitive ID/selfie collection.
5. Webhook updates the local verification-request record.
6. Only after a successful Stripe Identity status and any FreeTrust review rules pass should server-side code set the profile as verified.

Data-minimization rule: Stripe holds identity documents/biometrics; FreeTrust stores only status, provider IDs, timestamps, and non-sensitive audit metadata.

### Recommendation D — add WebAuthn/passkeys for transaction step-up

WebAuthn should be treated as transaction confirmation, not identity-document verification.

Recommended tables:

- `webauthn_credentials`
  - `id`
  - `user_id`
  - `credential_id` unique
  - `public_key`
  - `counter`
  - `transports`
  - `device_name`
  - `created_at`
  - `last_used_at`
- `transaction_auth_challenges`
  - `id`
  - `user_id`
  - `action`
  - `amount`
  - `currency`
  - `target_id`
  - `challenge`
  - `expires_at`
  - `used_at`

Step-up triggers should include:

- wallet transfers above a configured threshold;
- all EUR transfers;
- high-value Trust Coin transfers/spends;
- order release/dispute/cancel actions;
- changing payout/Stripe Connect details;
- optional: every transfer while feature is new.

Privacy rule: WebAuthn stores public keys and counters only. It does not store fingerprints, face scans, or device biometrics.

### Recommendation E — gate discovery by profile quality and verified status without hiding everyone

Recommended incremental discovery changes:

1. Keep `/api/directory/members` as the profile source of truth and keep the soft-delete filter.
2. Add a computed `profile_completeness` / `is_discoverable` rule server-side or in a view.
3. Default `/members` to show profiles with at least name plus one meaningful signal: bio, headline, avatar, location, social link, listing, or verification submitted/verified.
4. Do not show empty/no-bio accounts in every category. Category filters should require category signal.
5. Add a “New members” or “Recently joined” area if David still wants fresh signups visible before full profile completion.

### Recommendation F — phase implementation safely

Recommended phase order after approval:

1. **Phase 2: verification schema hardening**
   - Revise/add migration for verification enum, audit table, and DB-level guardrails.
   - Do not backfill any verified status yet.
2. **Phase 2.5: trust-tier copy cleanup**
   - Rename balance-derived “Verified Member” labels before or alongside badge work.
   - This is user-visible; prepare a short communications note before deploy.
3. **Phase 3: Stripe Identity**
   - Create verification-session route, webhook handling, review state, and UI.
4. **Phase 4: WebAuthn**
   - Add passkey enrollment and transaction challenge/verify routes.
5. **Phase 5: transaction gating**
   - Enforce step-up checks on wallet/Trust/order-sensitive routes.
6. **Phase 6: discovery quality**
   - Add discoverability rules and remove old completeness-derived “Verified” badges.

### Phase 1 stop condition

This report intentionally stops before migrations or implementation code. Next action should be explicit approval of Phase 2 scope, especially the database-level verification hardening approach.
