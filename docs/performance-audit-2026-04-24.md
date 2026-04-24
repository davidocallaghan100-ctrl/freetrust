# FreeTrust — End-to-End Performance & Reliability Audit
**Date:** 2026-04-24  
**Codebase:** `github.com/davidocallaghan100-ctrl/freetrust`  
**Auditor:** Adaptive AI Agent (Phase 1 — read-only)

---

## Legend
- **Impact:** High / Med / Low  
- **Effort:** XS (< 30 min) / S (30–90 min) / M (2–4 h) / L (half day+)

---

## 1.1 Bundle & Build

### Finding B-01 — Duplicate map libraries in production bundle
**Files:** `package.json` lines 22–24; `components/DeliveryZoneMap.tsx`; `components/delivery/DeliveryMap.tsx`; `components/marketing/HeroGlobe.tsx`; `components/map/ActivityMap.tsx`  
**Problem:** Three separate map libraries are installed and all end up in the client bundle:
- `mapbox-gl` (~370 KB gzipped) — used by `react-map-gl` for HeroGlobe & ActivityMap
- `maplibre-gl` (~420 KB gzipped) — used by DeliveryZoneMap directly
- `leaflet` + `react-leaflet` (~140 KB gzipped) — used only inside DeliveryMap, but imported as a full package dep even though it is lazy-loaded at runtime with `import('leaflet')`

Leaflet's package.json entry is still included in the initial bundle because it is a top-level production dependency and Next.js statically analyses the dep graph. `react-leaflet` is likewise always installed. The actual `import('leaflet')` call in `DeliveryMap.tsx` is correctly runtime-only, but the package overhead remains.  
**Impact:** High — ~930 KB of map JS is potentially parsed on routes that never render a map  
**Effort:** M

---

### Finding B-02 — `react-big-calendar` imported with full CSS in a client page
**File:** `app/calendar/page.tsx` line 18  
```ts
import 'react-big-calendar/lib/css/react-big-calendar.css'
```
**Problem:** This top-level CSS import in a `"use client"` page causes the entire ~80 KB stylesheet to be inlined into the page bundle for any route that shares this chunk. The calendar is only on `/calendar` but the CSS leaks into shared layouts if Next.js groups the chunk.  
**Impact:** Med  
**Effort:** XS

---

### Finding B-03 — `HeroGlobe` (`mapbox-gl` + `react-map-gl`) not dynamically imported on homepage
**Files:** `components/marketing/HomeClient.tsx` line 8; `app/page.tsx`  
**Problem:** `HomeClient.tsx` imports `HeroGlobe` statically at the top of the file. `HeroGlobe` itself imports `react-map-gl/mapbox` and `mapbox-gl/dist/mapbox-gl.css`, making the entire Mapbox GL bundle (~370 KB gzipped) part of the **homepage's initial JS payload**. This is the highest-traffic route on the site.  
**Impact:** High — directly damages homepage LCP and TTI  
**Effort:** S

---

### Finding B-04 — `recharts` imported statically in `admin/analytics/page.tsx`
**File:** `app/admin/analytics/page.tsx` lines 7–10  
**Problem:** Six recharts components (`LineChart`, `BarChart`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`, `Legend`) are imported at the top of an admin-only client page. Recharts is ~300 KB gzipped. Because the page is already `"use client"` and admin-only, the damage is scoped — but it could still be dynamic-imported to keep the shared chunk smaller.  
**Impact:** Low (admin only)  
**Effort:** XS

---

### Finding B-05 — Missing `experimental.optimizePackageImports` in `next.config.mjs`
**File:** `next.config.mjs`  
**Problem:** Next.js 14 supports `experimental.optimizePackageImports` which tree-shakes barrel exports from common packages (e.g. `@heroicons/react`, `date-fns`). This is not configured. `@heroicons/react` is used throughout the app with individual icon imports; without this config, every icon in the pack is bundled.  
**Impact:** Med — saves an estimated 40–80 KB from heroicons  
**Effort:** XS

---

### Finding B-06 — Missing `images.formats` (WebP/AVIF) in `next.config.mjs`
**File:** `next.config.mjs` lines 118–142  
**Problem:** `images.formats` is not set, so Next.js Image Optimisation defaults to serving WebP only when the browser doesn't also support AVIF. Explicitly setting `['image/avif', 'image/webp']` enables AVIF for modern browsers (Chrome, Edge, Firefox) — typically 30–50% smaller than WebP.  
**Impact:** Med — meaningful savings on listing / profile image-heavy pages  
**Effort:** XS

---

### Finding B-07 — `googleapis` (144 MB installed) is a full production dependency
**File:** `package.json` line 20  
**Problem:** `googleapis` is only used in `app/api/calendar/google/` routes for Google Calendar OAuth sync. It is installed as a production dep, pulling in the full Google API client (~144 MB on disk). It should be a narrower import or replaced with direct HTTP calls to the Calendar API.  
**Impact:** Med — bloats cold-start bundle size and serverless function payload  
**Effort:** M

---

### Finding B-08 — `pdf-lib` (production dep) used only in one invoice route
**File:** `package.json` line 23; `app/api/orders/[id]/invoice/route.ts`  
**Problem:** `pdf-lib` (~400 KB) is a production dependency used only in the `/api/orders/[id]/invoice` route. In a serverless context, this increases cold start time for all functions that share the same bundle.  
**Impact:** Low  
**Effort:** S (no code change needed — consider dynamic import inside the route handler)

---

## 1.2 Server vs Client Component Boundaries

### Finding SC-01 — Nearly all page files are fully client-rendered
**Files:** `app/admin/page.tsx`, `app/admin/analytics/page.tsx`, `app/admin/campaigns/page.tsx`, `app/admin/outbound/page.tsx`, `app/accounting/page.tsx`, `app/analytics/page.tsx`, `app/browse/page.tsx`, `app/articles/page.tsx`, `app/articles/[slug]/page.tsx`, `app/calendar/page.tsx`, `app/community/page.tsx`, `app/community/[slug]/page.tsx`, `app/connections/page.tsx`, `app/dashboard/page.tsx`, `app/events/page.tsx`, `app/feed/page.tsx`, `app/gig-economy/page.tsx`, `app/impact/page.tsx`, `app/jobs/page.tsx`, `app/members/page.tsx`, `app/messages/page.tsx`, `app/notifications/page.tsx`, `app/orders/page.tsx`, `app/organisations/page.tsx`, `app/products/page.tsx`, `app/rent-share/page.tsx`, `app/services/page.tsx`, `app/settings/page.tsx`, `app/wallet/page.tsx`  
**Problem:** Almost every page is a `"use client"` component that fetches data in `useEffect`. This means:
1. The browser receives an empty shell HTML + large JS bundle
2. JS executes, user sees nothing
3. API fetch starts (waterfall)
4. Data arrives, page renders

The Next.js App Router can eliminate steps 2–3 for the initial paint by using Server Components with server-side Supabase calls. The interactive parts (forms, clicks, real-time) can remain as client islands. This is the single largest architectural gap in the codebase.  
**Impact:** High — affects every route's LCP and FCP  
**Effort:** L (requires page-by-page refactor — should be planned route by route)

---

### Finding SC-02 — `AppShell` is fully client-side, wrapping the entire app
**File:** `components/AppShell.tsx`  
**Problem:** `AppShell` is `"use client"` and wraps every page. This forces the Nav, Sidebar, BottomNav, SearchBar, and TrustAssistant to all be client bundles. It also means every page payload includes the AppShell client JS even if the page itself is a Server Component. The push-prompt logic, geo-init, and service worker registration inside AppShell are legitimately client-only — but the static shell (layout, nav structure) could be extracted as a Server Component wrapper.  
**Impact:** Med — unnecessary client JS on every page  
**Effort:** M

---

### Finding SC-03 — `Nav.tsx` fetches profile + wallet on every page load
**File:** `components/Nav.tsx` lines 79–93  
**Problem:** The Nav fires two Supabase queries (`profiles` + `trust_balances`) in `useEffect` on every page render. These run client-side after hydration, causing a visible flicker where the nav renders without user data, then fills in. Since the Nav is inside `AppShell` (client), these could be fetched once in a server layout and passed down as props.  
**Impact:** High — causes visible layout shift / flicker on every page load  
**Effort:** M

---

### Finding SC-04 — `HeroGlobe` is `"use client"` but not wrapped in `dynamic()` at usage site
**File:** `components/marketing/HomeClient.tsx` line 8  
**Problem:** `HomeClient` imports `HeroGlobe` with a static `import`. `HeroGlobe` is `"use client"` and loads Mapbox GL. It should be wrapped in `dynamic(() => import('./HeroGlobe'), { ssr: false })` so Mapbox is excluded from the server render and the initial JS payload.  
**Impact:** High (homepage)  
**Effort:** XS

---

### Finding SC-05 — `OrganisationProfile` and related org components are all client components with data fetching
**Files:** `components/organisation/OrganisationProfile.tsx`, `app/organisations/[id]/OrgProfileClient.tsx`  
**Problem:** The entire org profile view is a client component that fetches data in `useEffect`. The static portions (name, description, contact info) could be server-rendered as a Server Component, with only the interactive parts (follow button, team join, review modal) as client islands.  
**Impact:** Med  
**Effort:** M

---

## 1.3 Data Fetching (Supabase)

### Finding DB-01 — `select('*')` on hot paths
**Files (selected critical ones):**
- `app/api/notifications/route.ts` line 21: `from('notifications').select('*')` — notifications can grow unboundedly per user
- `app/api/orders/[id]/route.ts` lines 37, 105: `select('*')` on orders
- `app/api/checkout/service/route.ts` line 34: `select('*')` on listings
- `app/api/checkout/product/route.ts` line 34: `select('*')` on listings
- `components/profile/ProfilePage.tsx` line 239: `select('*')` on profiles
- `app/settings/page.tsx` line 148: `select('*')` on profiles
- `app/events/calendar/page.tsx` line 85: `select("*")` on community_events
- `app/api/communities/[slug]/events/route.ts` line 24: `select('*')` on events
- `app/api/profile/route.ts` line 17: `select('*')` on profiles
- `app/api/organisations/route.ts` line 21: `select('*')` on organisations
- `app/articles/new/page.tsx` line 51: `select('*')` on articles (draft load)

**Problem:** Fetching all columns transfers unnecessary data over the network, increases Supabase bandwidth billing, and slows query planning. Specific column selection is always preferred.  
**Impact:** Med–High depending on table row width  
**Effort:** S per file

---

### Finding DB-02 — Critical N+1 pattern in `/api/messages` route
**File:** `app/api/messages/route.ts` lines 51–75  
**Problem:** The messages list endpoint loops over each conversation and fires **two additional queries per conversation** — one for the last message and one for unread count:
```ts
const enriched = await Promise.all((conversations || []).map(async (conv) => {
  const { data: lastMsg } = await supabase.from('messages').select(...).eq('conversation_id', conv.id)...
  const { count } = await supabase.from('messages').select(...).eq('conversation_id', conv.id)...
}))
```
For a user with 20 conversations this fires **41 queries** (1 + 20 + 20). This is a severe N+1 and will be the primary bottleneck on the `/messages` page.  
**Fix:** Use Supabase's relational query with embedded `messages(...)` or a single SQL window function via `rpc()`.  
**Impact:** High — `/messages` will slow down proportionally to conversation count  
**Effort:** M

---

### Finding DB-03 — `trust_balances` fetched entirely for stats aggregation (no SQL SUM)
**File:** `app/api/stats/route.ts` lines 52–58  
**Problem:**
```ts
supabase.from('trust_balances').select('lifetime'),    // fetches ALL rows
supabase.from('trust_balances').select('lifetime').gte('updated_at', weekAgo),
supabase.from('trust_balances').select('balance'),     // fetches ALL rows
```
These queries return every row in the `trust_balances` table to calculate totals in JavaScript. As membership grows, this transfers megabytes of data for three simple SUM operations. Supabase supports `select('sum(lifetime)')` or an RPC with `SUM()`.  
**Impact:** High — gets worse with every new member; already degraded at current scale  
**Effort:** S

---

### Finding DB-04 — Landing page preview routes are `force-dynamic` but data is near-static
**Files:** `app/api/landing/featured-preview/route.ts`, `app/api/landing/events-preview/route.ts`, `app/api/landing/jobs-preview/route.ts`  
**Problem:** These routes serve homepage preview data (featured rent-share, upcoming events, jobs). They are marked `force-dynamic` meaning no caching at all. This data changes at most every few hours. Adding `export const revalidate = 300` (5 minutes) would serve cached responses to most homepage visitors without hitting Supabase on every request.  
**Impact:** High — homepage is the highest-traffic route  
**Effort:** XS

---

### Finding DB-05 — Stats route (`/api/stats`) is `force-dynamic` with zero caching
**File:** `app/api/stats/route.ts` lines 4–5  
**Problem:** The stats endpoint is called by `HomeClient.tsx` on every page load. It fires 16 Supabase queries in parallel. Setting `revalidate = 60` (1 minute) would cache the result and reduce load by ~99% on a busy homepage.  
**Impact:** High  
**Effort:** XS

---

### Finding DB-06 — Missing `notifications` query limit in unread count hook
**File:** `app/api/notifications/route.ts`  
**Problem:** The default `limit` is `50` (from query params) but callers like `components/notifications/NotificationBell.tsx` may use defaults. For high-notification users the response is large. The `select('*')` compounds this.  
**Impact:** Low–Med  
**Effort:** XS

---

### Finding DB-07 — Proposed missing indexes (based on query patterns)
**Tables and columns queried without confirmed indexes:**

| Table | Column(s) | Query Pattern | Proposed Index |
|---|---|---|---|
| `listings` | `seller_id, status` | Dashboard count + listing page filters | `CREATE INDEX idx_listings_seller_status ON listings(seller_id, status)` |
| `listings` | `status, product_type` | Stats + browse | `CREATE INDEX idx_listings_status_product ON listings(status, product_type)` |
| `trust_balances` | `user_id` | Nearly every auth'd page | Likely already has this — confirm in Supabase |
| `trust_balances` | `updated_at` | Stats weekly query | `CREATE INDEX idx_trust_balances_updated_at ON trust_balances(updated_at)` |
| `feed_posts` | `user_id, created_at` | Feed + profile | `CREATE INDEX idx_feed_posts_user_created ON feed_posts(user_id, created_at DESC)` |
| `notifications` | `user_id, read, created_at` | Notification list + unread count | `CREATE INDEX idx_notifications_user_read ON notifications(user_id, read, created_at DESC)` |
| `messages` | `conversation_id, created_at` | Last message + unread per conv | `CREATE INDEX idx_messages_conv_created ON messages(conversation_id, created_at DESC)` |
| `conversation_participants` | `user_id` | Conversations list | `CREATE INDEX idx_conv_participants_user ON conversation_participants(user_id)` |
| `orders` | `buyer_id, status` | Orders list | `CREATE INDEX idx_orders_buyer_status ON orders(buyer_id, status)` |
| `orders` | `seller_id, status` | Seller dashboard | `CREATE INDEX idx_orders_seller_status ON orders(seller_id, status)` |
| `articles` | `author_id, status` | Author article count | `CREATE INDEX idx_articles_author_status ON articles(author_id, status)` |
| `jobs` | `status, created_at` | Jobs listing | `CREATE INDEX idx_jobs_status_created ON jobs(status, created_at DESC)` |
| `events` / `community_events` | `status, starts_at` | Upcoming events | `CREATE INDEX idx_events_status_starts ON community_events(status, starts_at)` |

**Impact:** High — index misses cause sequential scans on every query  
**Effort:** S (run SQL, verify with EXPLAIN ANALYZE)

```sql
-- paste this into Supabase SQL Editor → New Query → Run
CREATE INDEX IF NOT EXISTS idx_listings_seller_status ON listings(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_listings_status_product ON listings(status, product_type);
CREATE INDEX IF NOT EXISTS idx_trust_balances_updated_at ON trust_balances(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_created ON feed_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_articles_author_status ON articles(author_id, status);
CREATE INDEX IF NOT EXISTS idx_jobs_status_created ON jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_status_starts ON community_events(status, starts_at);
```

---

## 1.4 Images, Fonts, Third-party

### Finding I-01 — Pervasive use of `<img>` instead of `next/image`
**Affected files (representative sample — 60+ instances across the codebase):**
- `components/marketing/HomeClient.tsx` (listing cards, avatar images)
- `components/map/ActivityMap.tsx` (avatar images in map popups)
- `app/organisations/page.tsx`, `app/organisations/[id]/OrgProfileClient.tsx`
- `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`, `app/jobs/manage/page.tsx`
- `app/products/page.tsx`, `app/products/[id]/page.tsx`
- `app/rent-share/page.tsx`, `app/rent-share/[id]/page.tsx`
- `app/browse/page.tsx`, `app/members/page.tsx`
- `components/Nav.tsx` (the FreeTrust logo — loaded on every page)

**Problem:** Plain `<img>` tags:
- No lazy loading (unless manually added `loading="lazy"`)
- No automatic format conversion (WebP/AVIF)
- No size optimisation — full-resolution images loaded regardless of display size
- No blur placeholder → causes layout shift (CLS)
- No CDN caching through Next.js image pipeline

The logo in `Nav.tsx` is loaded from `davidocallaghan100829028694.adaptive.ai/cdn/` with a plain `<img>` — this is above the fold on every page and directly impacts LCP.  
**Impact:** High — LCP and CLS on every page  
**Effort:** M (systematic, but mechanical)

---

### Finding I-02 — `next/font` used correctly for Geist (good)
**File:** `app/layout.tsx` lines 10–18  
**Status:** ✅ `localFont` from `next/font/local` is used correctly for both Geist Sans and Geist Mono. No action needed.

---

### Finding I-03 — External Google Fonts CDN URL loaded via PWA service worker cache
**File:** `next.config.mjs` lines 59–64  
**Problem:** The `runtimeCaching` rule caches `fonts.googleapis.com` and `fonts.gstatic.com`. However, the codebase uses `next/font/local` for Geist — no Google Fonts are actually loaded. This cache rule is dead code adding unnecessary service worker complexity. Conversely, the CSS import `import 'react-big-calendar/lib/css/react-big-calendar.css'` and Mapbox GL CSS are loaded via external CDN (`unpkg.com` in CSP), which are not cached by the SW at all.  
**Impact:** Low  
**Effort:** XS

---

### Finding I-04 — `<Script>` for Google Analytics uses `afterInteractive` (good)
**File:** `app/layout.tsx` lines 143–151  
**Status:** ✅ GA4 is loaded with `strategy="afterInteractive"`. Correct.

---

### Finding I-05 — Mapbox/MapLibre CSS imported at module level in client components
**Files:** `components/marketing/HeroGlobe.tsx` line 6; `components/map/ActivityMap.tsx` line 5; `components/DeliveryZoneMap.tsx` line 5  
**Problem:** `import 'mapbox-gl/dist/mapbox-gl.css'` and `import 'maplibre-gl/dist/maplibre-gl.css'` at the top of client components cause these stylesheets (~100 KB each) to be included in the CSS bundle for any route that imports these components — even if the map is never shown.  
**Impact:** Med  
**Effort:** S (use CSS modules or inject styles conditionally)

---

## 1.5 Rendering & Loading States

### Finding R-01 — Zero `loading.tsx` files in the entire app
**Status:** No `loading.tsx` files exist anywhere in `app/`.  
**Problem:** Without `loading.tsx`, Next.js has no streaming loading state for any route. When a Server Component is slow (or when navigation happens), the user sees the previous page frozen until the new page fully renders. Adding `loading.tsx` to key routes enables React Streaming and instant navigation feedback.  
**Impact:** High — perceived performance on every page navigation  
**Effort:** S (one file per key route, can be a simple skeleton)

---

### Finding R-02 — Zero `error.tsx` files in the entire app
**Status:** No `error.tsx` files exist anywhere in `app/`.  
**Problem:** If any Server Component throws, Next.js falls back to a full-page error with no recovery. Client-side errors in `"use client"` components that aren't wrapped in error boundaries will crash the entire page.  
**Impact:** High — reliability risk on every route  
**Effort:** S (one root-level file covers everything; add per-route as needed)

---

### Finding R-03 — Entire homepage blocks on three Supabase count queries
**File:** `app/page.tsx` lines 55–63  
**Problem:** The homepage Server Component awaits `getLandingCounts()` before returning any HTML. Three Supabase queries run in parallel, but if any is slow (Supabase cold start, RLS overhead, table scan), the user sees nothing until all three complete. Since the counts are decorative (hero text), they could be fetched client-side after the page shell renders, or cached with `revalidate`.  
**Impact:** Med  
**Effort:** XS–S

---

### Finding R-04 — Serial data fetching in `Nav.tsx` blocks navigation paint
**File:** `components/Nav.tsx` lines 79–93  
**Problem:** The Nav fetches `profiles` and `trust_balances` in `useEffect` after mount. Until these resolve, the user sees the nav without their name/avatar/wallet balance. The `loading` state hides the user section entirely, causing a visible content shift when data arrives.  
**Impact:** High — CLS on every page, every visit  
**Effort:** M (pass user data from server layout)

---

### Finding R-05 — `/messages` page has no Suspense and fires N+1 queries
**Files:** `app/messages/page.tsx`; `app/api/messages/route.ts`  
**Problem:** Combined with DB-02, the messages page:
1. Renders as a full client component
2. Fetches in `useEffect`
3. The API fires N+1 queries
4. No loading skeleton during any of this

**Impact:** High — worst page for both reliability and perceived performance  
**Effort:** M

---

## 1.6 Caching & Revalidation

### Finding C-01 — Homepage is `force-dynamic` with `revalidate = 0` (never cached)
**File:** `app/page.tsx` lines 10–11  
**Problem:** The landing page (`/`) is never cached. Every visit hits Supabase for three count queries. For a public marketing page that serves anonymous traffic, this is the opposite of optimal. The member/listing/community counts change slowly — even a 60-second cache would save hundreds of Supabase reads per hour.  
**Recommendation:** Switch to `export const revalidate = 60` (ISR) and remove `force-dynamic`. The counts will be at most 60 seconds stale — acceptable for a hero counter.  
**Impact:** High  
**Effort:** XS

---

### Finding C-02 — Landing preview routes are all `force-dynamic` (no cache)
**Files:** `app/api/landing/featured-preview/route.ts`, `app/api/landing/events-preview/route.ts`, `app/api/landing/jobs-preview/route.ts`  
**Problem:** Same issue as C-01. These routes serve data for the homepage sections (rent listings, events, jobs). They change infrequently. Setting `revalidate = 300` would make them ISR-cached.  
**Impact:** High  
**Effort:** XS

---

### Finding C-03 — Stats endpoint (`/api/stats`) fetches 16 queries, zero cache
**File:** `app/api/stats/route.ts`  
**Problem:** Called by `HomeClient.tsx` on every visit, firing 16 concurrent Supabase queries (including two full table scans of `trust_balances` — see DB-03). Should be cached with `revalidate = 60` at minimum.  
**Impact:** High  
**Effort:** XS

---

### Finding C-04 — Public listing/org/event pages are `force-dynamic`
**Files:** `app/api/listings/route.ts`, `app/api/events/route.ts`, `app/api/organisations/route.ts`  
**Problem:** Public listing/event/org browse pages are always force-dynamic. The data is user-agnostic (same for every visitor) but refreshed on every request. Short-lived ISR (30–120 seconds) would significantly reduce Supabase load without meaningfully staling the UX.  
**Impact:** Med  
**Effort:** XS per route

---

### Finding C-05 — Middleware does significant work on every request
**File:** `middleware.ts`  
**Problem:** The middleware:
1. Parses the request body for login rate limiting (clones the body)
2. Creates a Supabase client and calls `supabase.auth.getUser()` (a network round-trip)
3. Applies security headers
4. Evaluates route protection

This runs on **every request** including `_next/static`, `_next/image`, and public pages. The `matcher` pattern excludes static assets correctly (line 210), but `supabase.auth.getUser()` still runs on every non-static route — including public pages like `/`, `/listings`, `/events`.  

Calling `getUser()` vs `getSession()`: `getUser()` makes a network call to Supabase Auth to validate the JWT with the server. `getSession()` reads the local cookie without a network round-trip. For route protection on public pages, `getSession()` is sufficient and avoids the latency.  
**Impact:** Med — adds ~50–150 ms to every request for the Supabase auth round-trip  
**Effort:** S

---

## 1.7 Core Web Vitals Risk

### Finding CWV-01 — `/` (Homepage) — LCP Risk: HIGH
**Root causes:**
- `HeroGlobe` (Mapbox GL, ~370 KB) in the initial JS payload
- Three blocking Supabase queries before any HTML is sent
- `HomeClient.tsx` fires additional `useEffect` fetches to `/api/stats` after mount
- Logo in Nav loaded with plain `<img>` (no preload, no priority)
- All hero content is client-rendered — first paint is an empty shell

**Predicted LCP:** > 4s on mobile (3G)

---

### Finding CWV-02 — `/messages` — INP Risk: HIGH, Reliability Risk: HIGH
**Root causes:** N+1 queries (DB-02), full client render, no loading state (R-05)

---

### Finding CWV-03 — `/listings` / `/services` / `/products` — CLS Risk: HIGH
**Root causes:**
- Listing card images are `<img>` without fixed dimensions → layout shifts as images load
- No `loading.tsx` → previous content shown during navigation

---

### Finding CWV-04 — `/organisations/[id]` — LCP Risk: MEDIUM
**Root causes:**
- Entire org profile is client-rendered (`OrgProfileClient.tsx`)
- Cover + logo images loaded with `<img>` without preload

---

### Finding CWV-05 — `/map` — LCP Risk: MEDIUM
**Root causes:**
- MapLibre GL (~420 KB) loaded via `dynamic()` correctly, but the map route itself adds ActivityMap which pulls Mapbox GL separately from MapLibre — two map libraries active on the same route
- `/api/map/pins` is `force-dynamic` with no cache

---

### Top 5 Routes Most Likely to Fail Core Web Vitals
1. `/` — LCP (homepage cold load with Mapbox in initial bundle)
2. `/messages` — INP (N+1 queries, full re-render on every message)
3. `/listings` (product/service browse) — CLS (image shifting)
4. `/organisations/[id]` — LCP (full client render, cover image not optimised)
5. `/map` — LCP (dual map libraries, no static preload content)

---

## 1.8 Reliability

### Finding REL-01 — N+1 queries in `/api/messages` have no error boundary
**File:** `app/api/messages/route.ts` lines 51–75  
**Problem:** The `Promise.all` map can partially fail — if one conversation's last-message query throws, the entire response fails. Individual query errors inside the map are not caught per-item.  
**Impact:** High  
**Effort:** S

---

### Finding REL-02 — Many Supabase calls do not check `{ error }` from the response
**Quantified:** ~52 calls check `{ data, error }` out of ~640 `await supabase.from(...)` calls in API routes (≈8% error-checked). The vast majority either destructure only `{ data }` or fire and forget.  
**Impact:** High — silent failures, data corruption risk, undetected Supabase errors  
**Effort:** M (systematic — can be linted)

---

### Finding REL-03 — `HeroGlobe` has no error boundary (Mapbox token missing = white screen)
**File:** `components/marketing/HeroGlobe.tsx`  
**Problem:** If `NEXT_PUBLIC_MAPBOX_TOKEN` is missing or invalid, Mapbox GL will throw during map initialisation. This error is not caught and will propagate to crash `HomeClient.tsx`, potentially blanking the homepage.  
**Impact:** High  
**Effort:** XS (wrap in try/catch + fallback UI in the component)

---

### Finding REL-04 — `TrustAssistant` Anthropic calls have no client-side error boundary
**File:** `components/TrustAssistant.tsx`  
**Problem:** The AI chat component streams from `/api/assistant/chat`. If the API throws (Anthropic outage, rate limit), the error bubbles up unhandled in the client component. No `error.tsx` or `ErrorBoundary` wraps it.  
**Impact:** Med  
**Effort:** XS

---

### Finding REL-05 — Auth callback does not handle referral insert failure gracefully
**File:** `app/auth/callback/route.ts` lines 169–185  
**Problem:** The referral and notification inserts in the OAuth callback are inside `try/catch` blocks, but failures are only logged — the user is still redirected to onboarding. This is the correct pattern, but the referral record and welcome notification could silently fail without alerting. No retry or audit trail exists.  
**Impact:** Low (functional), High (business — unrewarded referrals)  
**Effort:** S

---

### Finding REL-06 — Client-side state is lost on refresh for multi-step flows
**Files:** `app/create/page.tsx`, `app/grassroots/new/page.tsx`, `app/rent-share/new/page.tsx`, `app/articles/new/page.tsx`  
**Problem:** Multi-step creation forms store all draft state in `useState`. Refreshing the page loses all progress. Articles have a partial fix (drafts saved to Supabase), but grassroots and rent-share listings have no draft persistence. This is a UX reliability issue.  
**Impact:** Med  
**Effort:** M per form (add `localStorage` or server-side draft save)

---

### Finding REL-07 — `/api/debug-env` route is exposed in production
**File:** `app/api/debug-env/route.ts`  
**Problem:** A debug route that reads environment variable presence is deployed to production. Even if it only exposes boolean "is set" flags, it leaks infrastructure details to anyone who knows the URL.  
**Impact:** Med (security)  
**Effort:** XS (add `if (process.env.NODE_ENV !== 'development') return 404`)

---

## Summary Table (Quick Reference)

| ID | Section | Impact | Effort | Description |
|---|---|---|---|---|
| B-03 | Bundle | High | S | HeroGlobe not dynamically imported on homepage |
| SC-01 | Architecture | High | L | All pages are full client renders with useEffect data fetching |
| SC-03 | Client Boundaries | High | M | Nav fetches on every page, causes flicker |
| SC-04 | Client Boundaries | High | XS | HeroGlobe static import in HomeClient |
| DB-02 | Data Fetching | High | M | N+1 queries in /api/messages |
| DB-03 | Data Fetching | High | S | Full table scans for trust_balances SUM |
| DB-04 | Data Fetching | High | XS | Landing preview routes not cached |
| DB-05 | Data Fetching | High | XS | Stats endpoint not cached |
| DB-07 | Indexes | High | S | 12 missing database indexes |
| I-01 | Images | High | M | 60+ raw `<img>` tags — no optimisation |
| R-01 | Loading | High | S | Zero loading.tsx files |
| R-02 | Error | High | S | Zero error.tsx files |
| C-01 | Caching | High | XS | Homepage is force-dynamic, never cached |
| C-02 | Caching | High | XS | Landing API routes not cached |
| C-03 | Caching | High | XS | Stats route not cached |
| REL-02 | Reliability | High | M | ~92% of Supabase calls don't check errors |
| REL-03 | Reliability | High | XS | HeroGlobe has no error boundary |
| REL-07 | Security | Med | XS | /api/debug-env exposed in production |
| B-01 | Bundle | High | M | Three map libraries in bundle |
| B-05 | Bundle | Med | XS | Missing optimizePackageImports |
| B-06 | Bundle | Med | XS | Missing images.formats (AVIF) |
| C-05 | Middleware | Med | S | getUser() called on every request |
| SC-02 | Client Boundaries | Med | M | AppShell fully client-side |
| B-02 | Bundle | Med | XS | react-big-calendar CSS in shared bundle |
| B-07 | Bundle | Med | M | googleapis full package in production |

---

## Honest Pushback

**Infrastructure vs code:** If FreeTrust is on Supabase Free tier, the connection pool limit (10 concurrent connections) will cap performance regardless of code optimisations. The N+1 queries (DB-02) and full table scans (DB-03) will hit this limit first. The index recommendations (DB-07) and caching changes (C-01 through C-05) will have the largest real-world impact per hour of effort.

**Mapbox vs MapLibre:** Both are installed and used in production simultaneously. MapLibre is open-source and free; Mapbox requires a token and has usage costs. Consider consolidating on MapLibre for all maps (ActivityMap, HeroGlobe) to eliminate the Mapbox dependency, reduce bundle size, and remove billing risk. This is a deliberate architectural decision — flagging it rather than acting on it.

**`googletagmanager.com` in CSP `script-src`:** The middleware CSP allows `https://www.googletagmanager.com` in `script-src`, while `next.config.mjs` headers do not include it. The two CSP definitions are inconsistent. The middleware one (which runs on all routes) is more permissive. A unified CSP definition should live in one place.

**Architecture gap — client-only pages:** The finding SC-01 (all pages are client-rendered) is the highest-leverage refactor but also the highest effort. It should be treated as a separate multi-week project, not a quick fix. Prioritise the XS/S/M items first to see meaningful metric improvements, then plan the server-component migration route by route.

---

*End of Phase 1 Audit — awaiting David's approval before beginning Phase 2 fixes.*
