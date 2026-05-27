-- Allow feed comments and reactions to be made as an administered organisation.
-- The human user_id remains stored for accountability/permissions; the optional
-- posted_as_organisation_id controls public display identity.

alter table feed_comments
  add column if not exists posted_as_organisation_id uuid references organisations(id) on delete set null;

create index if not exists idx_feed_comments_posted_as_org
  on feed_comments(posted_as_organisation_id);

alter table feed_reactions
  add column if not exists posted_as_organisation_id uuid references organisations(id) on delete cascade;

create index if not exists idx_feed_reactions_posted_as_org
  on feed_reactions(posted_as_organisation_id);

-- Replace the old one-reaction-per-user constraint with one reaction per
-- visible identity: personal, or each administered page.
alter table feed_reactions
  drop constraint if exists feed_reactions_post_id_user_id_key;

create unique index if not exists feed_reactions_personal_identity_key
  on feed_reactions(post_id, user_id)
  where posted_as_organisation_id is null;

create unique index if not exists feed_reactions_org_identity_key
  on feed_reactions(post_id, user_id, posted_as_organisation_id)
  where posted_as_organisation_id is not null;
