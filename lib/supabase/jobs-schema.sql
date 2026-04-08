-- ============================================================
-- Jobs Board Schema
-- ============================================================

create table if not exists jobs (
  id                   uuid primary key default uuid_generate_v4(),
  poster_id            uuid references profiles(id) on delete cascade not null,
  organisation_id      uuid references profiles(id) on delete set null,
  title                text not null,
  description          text not null,
  requirements         text,
  job_type             text not null check (job_type in ('full_time','part_time','contract','freelance')),
  location_type        text not null check (location_type in ('remote','hybrid','on_site')),
  location             text,
  salary_min           integer,
  salary_max           integer,
  salary_currency      text not null default 'GBP',
  category             text not null,
  tags                 text[] not null default '{}',
  application_deadline timestamptz,
  status               text not null default 'active' check (status in ('active','closed','draft')),
  applicant_count      integer not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists job_applications (
  id             uuid primary key default uuid_generate_v4(),
  job_id         uuid references jobs(id) on delete cascade not null,
  applicant_id   uuid references profiles(id) on delete cascade not null,
  cover_letter   text,
  cv_url         text,
  portfolio_url  text,
  status         text not null default 'pending' check (status in ('pending','reviewed','shortlisted','rejected','hired')),
  created_at     timestamptz not null default now(),
  unique(job_id, applicant_id)
);

-- RLS
alter table jobs enable row level security;
alter table job_applications enable row level security;

-- Jobs: anyone can read active jobs; auth users can insert; owners can update/delete
create policy "Active jobs are public" on jobs
  for select using (status = 'active' or poster_id = auth.uid());

create policy "Auth users can post jobs" on jobs
  for insert with check (auth.uid() = poster_id);

create policy "Owners can update own jobs" on jobs
  for update using (auth.uid() = poster_id);

create policy "Owners can delete own jobs" on jobs
  for delete using (auth.uid() = poster_id);

-- Applications: applicant sees own; job poster sees all for their jobs
create policy "Applicants see own applications" on job_applications
  for select using (
    auth.uid() = applicant_id or
    exists (select 1 from jobs j where j.id = job_id and j.poster_id = auth.uid())
  );

create policy "Auth users can apply" on job_applications
  for insert with check (auth.uid() = applicant_id);

create policy "Poster can update application status" on job_applications
  for update using (
    exists (select 1 from jobs j where j.id = job_id and j.poster_id = auth.uid())
  );

-- Indexes
create index if not exists jobs_status_idx on jobs(status);
create index if not exists jobs_category_idx on jobs(category);
create index if not exists jobs_job_type_idx on jobs(job_type);
create index if not exists jobs_location_type_idx on jobs(location_type);
create index if not exists job_applications_applicant_idx on job_applications(applicant_id);
create index if not exists job_applications_job_idx on job_applications(job_id);

-- updated_at trigger for jobs
create or replace function update_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger jobs_updated_at
  before update on jobs
  for each row execute procedure update_jobs_updated_at();

-- Trust trigger: ₮5 on new application
create or replace function award_trust_on_application()
returns trigger as $$
declare
  v_title text;
begin
  select title into v_title from jobs where id = new.job_id;
  perform issue_trust(
    new.applicant_id,
    5,
    'job_application',
    new.job_id,
    'Applied for: ' || coalesce(v_title, 'a job')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_job_application_insert
  after insert on job_applications
  for each row execute procedure award_trust_on_application();

-- Trust trigger: ₮25 to poster when they hire someone
create or replace function award_trust_on_hire()
returns trigger as $$
declare
  v_poster_id uuid;
  v_title text;
begin
  if new.status = 'hired' and (old.status is null or old.status != 'hired') then
    select j.poster_id, j.title into v_poster_id, v_title
    from jobs j where j.id = new.job_id;

    if v_poster_id is not null then
      perform issue_trust(
        v_poster_id,
        25,
        'hired_via_freetrust',
        new.job_id,
        'Hired via FreeTrust: ' || coalesce(v_title, 'a job')
      );
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_application_hired
  after update on job_applications
  for each row execute procedure award_trust_on_hire();
