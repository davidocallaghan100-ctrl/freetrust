-- Track public article reads without requiring a member account.
alter table public.articles
  add column if not exists view_count integer not null default 0;

-- Increment atomically so simultaneous readers cannot overwrite each other.
create or replace function public.increment_article_view_count(p_article_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.articles
     set view_count = coalesce(view_count, 0) + 1
   where id = p_article_id
     and status = 'published'
  returning view_count into next_count;

  return coalesce(next_count, 0);
end;
$$;

revoke all on function public.increment_article_view_count(uuid) from public;
grant execute on function public.increment_article_view_count(uuid) to anon, authenticated;
