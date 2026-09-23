/**
 * Server instrumentation intentionally has no database side effects.
 *
 * FreeTrust schema changes belong in tracked Supabase migrations. Creating
 * tables or inserting demo rows from a serverless cold start is unsafe: it
 * adds startup latency, races across instances, and can leak fabricated data
 * into production. Use the migration files under supabase/migrations/ for
 * setup and the Supabase deployment workflow for applying them.
 */
export async function register() {
  // Reserved for observability hooks that are safe to run on every instance.
}
