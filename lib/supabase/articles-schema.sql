-- ============================================================
-- Articles Platform Schema
-- ============================================================

-- Articles table
create table if not exists articles (
  id                uuid primary key default uuid_generate_v4(),
  author_id         uuid references profiles(id) on delete cascade not null,
  title             text not null,
  slug              text not null unique,
  excerpt           text,
  body              text not null default '',
  featured_image_url text,
  status            text not null default 'draft' check (status in ('draft', 'published')),
  category          text,
  tags              text[] not null default '{}',
  clap_count        integer not null default 0,
  comment_count     integer not null default 0,
  read_time_minutes integer not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  published_at      timestamptz
);

-- Article claps (one row per user per clap, max 50 per user per article)
create table if not exists article_claps (
  id         uuid primary key default uuid_generate_v4(),
  article_id uuid references articles(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

-- Article comments
create table if not exists article_comments (
  id         uuid primary key default uuid_generate_v4(),
  article_id uuid references articles(id) on delete cascade not null,
  author_id  uuid references profiles(id) on delete cascade not null,
  parent_id  uuid references article_comments(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists articles_author_idx on articles(author_id);
create index if not exists articles_slug_idx on articles(slug);
create index if not exists articles_status_idx on articles(status);
create index if not exists articles_category_idx on articles(category);
create index if not exists article_claps_article_idx on article_claps(article_id);
create index if not exists article_claps_user_idx on article_claps(user_id, article_id);
create index if not exists article_comments_article_idx on article_comments(article_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table articles enable row level security;
alter table article_claps enable row level security;
alter table article_comments enable row level security;

-- Articles: public read published, author reads own drafts
create policy "Published articles are public"
  on articles for select
  using (status = 'published' or auth.uid() = author_id);

create policy "Authenticated users can create articles"
  on articles for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own articles"
  on articles for update
  using (auth.uid() = author_id);

create policy "Authors can delete own articles"
  on articles for delete
  using (auth.uid() = author_id);

-- Article claps: public read, authenticated insert/delete own
create policy "Anyone can read claps"
  on article_claps for select
  using (true);

create policy "Authenticated users can clap"
  on article_claps for insert
  with check (auth.uid() = user_id);

create policy "Users can remove own claps"
  on article_claps for delete
  using (auth.uid() = user_id);

-- Article comments: public read published article comments, authenticated insert own
create policy "Anyone can read comments"
  on article_comments for select
  using (true);

create policy "Authenticated users can comment"
  on article_comments for insert
  with check (auth.uid() = author_id);

create policy "Authors can update own comments"
  on article_comments for update
  using (auth.uid() = author_id);

create policy "Authors can delete own comments"
  on article_comments for delete
  using (auth.uid() = author_id);

-- ── Functions ────────────────────────────────────────────────────────────────

-- Auto-update updated_at
create or replace function update_articles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger articles_updated_at
  before update on articles
  for each row execute function update_articles_updated_at();

create trigger article_comments_updated_at
  before update on article_comments
  for each row execute function update_articles_updated_at();

-- Award trust on publish
create or replace function award_trust_on_publish()
returns trigger as $$
begin
  -- Only fire when status transitions to 'published'
  if (TG_OP = 'INSERT' and new.status = 'published') or
     (TG_OP = 'UPDATE' and old.status = 'draft' and new.status = 'published') then
    -- Set published_at if not already set
    if new.published_at is null then
      new.published_at = now();
    end if;
    -- Issue ₮20 trust reward
    perform issue_trust(
      new.author_id,
      20,
      'article_published',
      new.id,
      'Published article: ' || new.title
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger articles_trust_on_publish
  before insert or update on articles
  for each row execute function award_trust_on_publish();
