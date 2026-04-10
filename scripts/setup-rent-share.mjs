/**
 * FreeTrust — Rent & Share one-time database setup
 *
 * Usage:
 *   1. Find your Supabase DB password:
 *      https://app.supabase.com/project/tioqakxnqjxyuzgnwhrb/settings/database
 *      → "Connection string" → URI (copy the password from it)
 *
 *   2. Add to .env.local:
 *      DATABASE_URL=postgresql://postgres.tioqakxnqjxyuzgnwhrb:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
 *
 *   3. Run:
 *      node scripts/setup-rent-share.mjs
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env.local manually
function loadEnv() {
  try {
    const env = readFileSync(join(__dirname, '../.env.local'), 'utf8')
    for (const line of env.split('\n')) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  } catch { /* .env.local not found */ }
}

loadEnv()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  console.error('\x1b[31mERROR: DATABASE_URL not set in .env.local\x1b[0m')
  console.error('')
  console.error('Get your database password from:')
  console.error('  https://app.supabase.com/project/tioqakxnqjxyuzgnwhrb/settings/database')
  console.error('')
  console.error('Then add to .env.local:')
  console.error('  DATABASE_URL=postgresql://postgres.tioqakxnqjxyuzgnwhrb:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres')
  process.exit(1)
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const sql = readFileSync(join(__dirname, '../supabase/setup-rent-share.sql'), 'utf8')

try {
  console.log('Connecting to database…')
  await client.connect()
  console.log('Running setup-rent-share.sql…')
  await client.query(sql)
  console.log('\x1b[32m✓ Rent & Share tables created and seeded successfully\x1b[0m')
} catch (err) {
  console.error('\x1b[31mSetup failed:\x1b[0m', err.message)
  if (err.message.includes('duplicate') || err.message.includes('already exists')) {
    console.log('(Some objects may already exist — that is OK)')
  }
  process.exit(1)
} finally {
  await client.end()
}
