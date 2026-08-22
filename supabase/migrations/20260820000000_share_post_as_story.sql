-- =============================================================================
-- Share Post to Story
-- =============================================================================
-- Lets any authenticated user share a feed post (any post type — text, link,
-- photo, video, music, poll, service, job, etc.) as a 24h Story on their own
-- profile. The sharer, not the original post's author, owns the new story
-- (mirrors repost_memory_as_story's "you own what you post" pattern).
--
-- Since `stories.media_type` was previously constrained to ('image','video')
-- and most feed post types have no single image/video to point the story's
-- `media_url` at, we:
--   1. Add 'shared_post' as a third allowed media_type.
--   2. Add `shared_post_id` (nullable FK to feed_posts, ON DELETE SET NULL —
--      lets the story optionally deep-link back to the live post) and
--      `shared_post_snapshot` (jsonb) columns. The snapshot is captured at
--      share time and is what StoryViewer actually renders, so the shared
--      story keeps displaying correctly even if the original post is later
--      edited or deleted.
--   3. `media_url` stays NOT NULL on the table — for shared_post stories we
--      store the original post's media_url there too (or '' if the post had
--      none) purely so existing NOT NULL/media_url-based code paths don't
--      need special-casing; StoryViewer renders shared_post stories from the
--      snapshot, not from media_url directly.
--
-- Project ref: tioqakxnqjxyuzgnwhrb (FreeTrust) — do NOT run against any
-- other Supabase project.
-- =============================================================================

-- ── 1. Schema ────────────────────────────────────────────────────────────────

alter table stories drop constraint if exists stories_media_type_check;
alter table stories add constraint stories_media_type_check
  check (media_type in ('image', 'video', 'shared_post'));

alter table stories add column if not exists shared_post_id uuid references feed_posts(id) on delete set null;
alter table stories add column if not exists shared_post_snapshot jsonb;

create index if not exists idx_stories_shared_post_id on stories(shared_post_id);

-- ── 2. RPC ───────────────────────────────────────────────────────────────────

-- share_post_as_story: any authenticated user may share any feed post they
-- can currently see. Builds a point-in-time snapshot (post type, title,
-- content, media, author display info) so the resulting story survives
-- later edits/deletion of the source post. Always creates a brand-new
-- stories row owned by the caller (auth.uid()), never the original author —
-- same "fresh id / now()+24h / view_count=0" shape as repost_memory_as_story.
create or replace function share_post_as_story(p_post_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post feed_posts;
  v_author_name text;
  v_author_avatar text;
  v_display_name text;
  v_display_avatar text;
  v_snapshot jsonb;
  v_new_story_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_post from feed_posts where id = p_post_id;

  if v_post.id is null then
    raise exception 'Post not found';
  end if;

  -- Resolve display name/avatar the same way the feed does: an org override
  -- (posted_as_organisation_id) takes precedence over the human author's
  -- own profile, since that's what viewers actually saw on the card.
  select p.full_name, p.avatar_url into v_author_name, v_author_avatar
    from profiles p where p.id = v_post.user_id;

  if v_post.posted_as_organisation_id is not null then
    select o.name, o.logo_url into v_display_name, v_display_avatar
      from organisations o where o.id = v_post.posted_as_organisation_id;
  else
    v_display_name := v_author_name;
    v_display_avatar := v_author_avatar;
  end if;

  v_snapshot := jsonb_build_object(
    'post_type', v_post.type,
    'title', v_post.title,
    'content', v_post.content,
    'media_url', v_post.media_url,
    'media_type', v_post.media_type,
    'link_url', v_post.link_url,
    'author_name', coalesce(v_display_name, 'FreeTrust member'),
    'author_avatar_url', v_display_avatar,
    'is_organisation', v_post.posted_as_organisation_id is not null,
    'original_post_id', v_post.id,
    'original_created_at', v_post.created_at
  );

  insert into stories (user_id, media_url, media_type, caption, duration_seconds, expires_at, saved_as_memory, view_count, shared_post_id, shared_post_snapshot)
  values (
    auth.uid(),
    coalesce(v_post.media_url, ''),
    'shared_post',
    null,
    8,
    now() + interval '24 hours',
    false,
    0,
    v_post.id,
    v_snapshot
  )
  returning id into v_new_story_id;

  return v_new_story_id;
end;
$$;

revoke all on function share_post_as_story(uuid) from public;
grant execute on function share_post_as_story(uuid) to authenticated;
