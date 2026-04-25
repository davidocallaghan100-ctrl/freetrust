# FreeTrust — Performance & Reliability Fixes Log

Append-only. Each entry records what changed, why, and any commands David must run.

---

## Fix REL-07 — Disable `/api/debug-env` in production
**Commit:** security: disable /api/debug-env route (REL-07)
**Date:** 2026-04-25
**Files:** `app/api/debug-env/route.ts`

The `/api/debug-env` endpoint was publicly accessible in production and returned sensitive internal state: the Supabase project URL, a boolean indicating whether `SUPABASE_SERVICE_ROLE_KEY` was set, **the first 30 characters of that key**, a row count from the `outbound_leads` table, and any DB error messages. This is a critical information-disclosure vulnerability — the service role key prefix substantially narrows brute-force search space and confirms the key format. The endpoint has been replaced with a hard 404 in all environments. A comment block preserves the context so no future developer accidentally reinstates it without adding proper admin-role authentication and environment gating first.

**Commands David must run:** none.

---
