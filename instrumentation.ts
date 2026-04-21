/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * If DATABASE_URL is set in .env.local, this auto-creates the
 * rent_share_listings and rent_share_requests tables (idempotent).
 *
 * Get your DB password from:
 *   https://app.supabase.com/project/tioqakxnqjxyuzgnwhrb/settings/database
 * Then add to .env.local:
 *   DATABASE_URL=postgresql://postgres.tioqakxnqjxyuzgnwhrb:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
 */

const SETUP_SQL = `
create table if not exists rent_share_listings (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  title           text        not null check (char_length(title) >= 3),
  description     text        not null check (char_length(description) >= 10),
  category        text        not null default 'Other',
  price_per_day   numeric(10,2),
  price_per_week  numeric(10,2),
  deposit         numeric(10,2) default 0,
  location        text,
  images          text[]      default '{}',
  available_from  date,
  available_to    date,
  status          text        not null default 'active'
                              check (status in ('active','rented','inactive')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists rent_share_requests (
  id            uuid        primary key default gen_random_uuid(),
  listing_id    uuid        not null references rent_share_listings(id) on delete cascade,
  requester_id  uuid        not null references profiles(id) on delete cascade,
  from_date     date        not null,
  to_date       date        not null,
  message       text,
  status        text        not null default 'pending'
                            check (status in ('pending','approved','declined','cancelled')),
  created_at    timestamptz not null default now()
);

alter table rent_share_listings enable row level security;
alter table rent_share_requests  enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'rent_share_listings'
    and policyname = 'Public read rent_share_listings'
  ) then
    execute $policy$
      create policy "Public read rent_share_listings"
        on rent_share_listings for select
        using ( status = 'active' or auth.uid() = user_id )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'rent_share_listings'
    and policyname = 'Authenticated insert rent_share_listings'
  ) then
    execute $policy$
      create policy "Authenticated insert rent_share_listings"
        on rent_share_listings for insert
        with check ( auth.uid() = user_id )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'rent_share_listings'
    and policyname = 'Owner update rent_share_listings'
  ) then
    execute $policy$
      create policy "Owner update rent_share_listings"
        on rent_share_listings for update
        using ( auth.uid() = user_id )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'rent_share_listings'
    and policyname = 'Owner delete rent_share_listings'
  ) then
    execute $policy$
      create policy "Owner delete rent_share_listings"
        on rent_share_listings for delete
        using ( auth.uid() = user_id )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'rent_share_requests'
    and policyname = 'Authenticated insert rent_share_requests'
  ) then
    execute $policy$
      create policy "Authenticated insert rent_share_requests"
        on rent_share_requests for insert
        with check ( auth.uid() = requester_id )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'rent_share_requests'
    and policyname = 'View own rent_share_requests'
  ) then
    execute $policy$
      create policy "View own rent_share_requests"
        on rent_share_requests for select
        using (
          auth.uid() = requester_id
          or auth.uid() in (
            select user_id from rent_share_listings where id = listing_id
          )
        )
    $policy$;
  end if;
end $$;
`

const SEED_SQL = `
do $$
declare v_user_id uuid;
declare already_seeded int;
begin
  select count(*) into already_seeded from rent_share_listings;
  if already_seeded > 0 then return; end if;

  select id into v_user_id from profiles where role = 'admin' limit 1;
  if v_user_id is null then select id into v_user_id from profiles limit 1; end if;
  if v_user_id is null then return; end if;

  insert into rent_share_listings
    (user_id,title,description,category,price_per_day,price_per_week,deposit,location,images,available_from,available_to,status)
  values
  (v_user_id,'Bosch GSB 18V-55 Impact Drill','High-performance cordless impact drill in excellent condition. Two 18V batteries, charger, and full bit set in carry case. Perfect for DIY, flat-pack assembly, and masonry work.','Tools',8,35,50,'Dublin 8',array['https://picsum.photos/seed/drill123/600/400'],'2026-04-10','2026-12-31','active'),
  (v_user_id,'Sony A7III Mirrorless Camera','Full-frame Sony A7III with 28-70mm kit lens. Mint condition. Extra battery, 64GB SD card, and padded carry bag included. Perfect for weekend shoots and events.','Electronics',35,160,300,'Cork City',array['https://picsum.photos/seed/camera456/600/400'],'2026-04-15','2026-11-30','active'),
  (v_user_id,'Electric Cargo Bike (Urban Arrow)','Urban Arrow family cargo e-bike with front cargo box. Fits two kids or large loads. Pedal-assist to 25km/h. Rain cover, child seat insert, and lock included.','Vehicles',25,110,100,'Galway City',array['https://picsum.photos/seed/cargobike/600/400'],'2026-04-11','2026-10-31','active'),
  (v_user_id,'Three-Man Camping Tent (Vango Blade 300)','Lightweight 1.9kg three-season tent. Quick pitch, used twice. Ground sheet, pegs, and carry bag included. Great for festivals, hillwalking, or camping trips.','Equipment',12,50,40,'Wicklow Town',array['https://picsum.photos/seed/tent789/600/400'],'2026-04-20','2026-09-30','active'),
  (v_user_id,'Karcher K5 Pressure Washer','Powerful 145-bar pressure washer with 10m hose. Great for driveways, patios, garden furniture, and cars. Patio cleaning attachment and vario lance included.','Tools',18,70,60,'Dublin 12',array['https://picsum.photos/seed/pressure/600/400'],'2026-04-12',null,'active'),
  (v_user_id,'Formal Suit — Dark Navy, Size 40R','Dark navy two-piece suit worn once at a wedding. Dry cleaned and in perfect condition. Includes matching tie and pocket square. Great for interviews and functions.','Clothing',25,80,50,'Limerick City',array['https://picsum.photos/seed/formalsuit/600/400'],'2026-04-10','2026-12-31','active'),
  (v_user_id,'Kayak with Paddle & Life Jacket','Sit-on-top 9ft recreational kayak. Suitable for flat water, rivers, and sheltered coast. Two-part paddle, adult life jacket, and dry bag included.','Equipment',30,120,80,'Galway Bay area',array['https://picsum.photos/seed/kayak999/600/400'],'2026-05-01','2026-09-15','active'),
  (v_user_id,'JBL Eon One Pro PA Speaker','Professional 1000W PA speaker with 4-channel mixer, Bluetooth, and 10-hour battery. Ideal for outdoor events, house parties, and small gigs.','Electronics',40,170,150,'Cork City',array['https://picsum.photos/seed/speaker111/600/400'],'2026-04-10',null,'active'),
  (v_user_id,'Dry Storage Unit 10m² — Dublin','Clean, dry, ground-floor storage for furniture, boxes, bikes, or stock. Secure building, 24/7 access. Near M50. Minimum 2-day booking.','Space',8,40,0,'Dublin 22',array['https://picsum.photos/seed/storage222/600/400'],'2026-04-13',null,'active'),
  (v_user_id,'Brother Sewing Machine (FS40S)','Beginner-friendly machine with 40 stitch patterns and auto needle threader. Great for repairs, alterations, curtains, and craft projects.','Electronics',10,40,30,'Cork Suburbs',array['https://picsum.photos/seed/sewing333/600/400'],'2026-04-10','2026-12-31','active'),
  (v_user_id,'Makita 18V Circular Saw (DHS660Z)','Cordless 165mm circular saw. Includes blade, dust extraction adapter, and guide rail. Ideal for timber cutting and renovation work.','Tools',15,60,80,'Dublin 15',array['https://picsum.photos/seed/circsaw/600/400'],'2026-04-14',null,'active'),
  (v_user_id,'Roof Tent — Free Community Borrow','Folding roof tent for 4x4s and SUVs. Two-person capacity with foam mattress. FreeTrust community share — just cover return transport costs.','Equipment',0,0,50,'Galway',array['https://picsum.photos/seed/rooftent/600/400'],'2026-05-01','2026-08-31','active');

  raise notice 'Seeded 12 rent_share_listings for user %', v_user_id;
end $$;
`

export async function register() {
  // Only run in Node.js runtime (pg is not available in Edge runtime)
  if (process.env.NEXT_RUNTIME === 'edge') return

  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    // Silent — DATABASE_URL is optional; user can also run setup manually
    return
  }

  try {
    const { default: pg } = await import('pg')
    const client = new pg.Client({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    })
    await client.connect()

    // Check if table already exists
    const { rows } = await client.query(
      `SELECT EXISTS (
         SELECT FROM information_schema.tables
         WHERE table_schema = 'public'
         AND   table_name   = 'rent_share_listings'
       ) AS exists`
    )

    if (!rows[0].exists) {
      console.log('[instrumentation] Creating rent_share tables…')
      await client.query(SETUP_SQL)
      console.log('[instrumentation] ✓ Tables and policies created')
    }

    // Always try to seed (no-op if data exists)
    await client.query(SEED_SQL)

    await client.end()
  } catch (err) {
    // Log but don't crash the server
    console.error('[instrumentation] rent_share migration error:', (err as Error).message)
  }
}
