-- Allow marketplace service listings to be offered by an organisation page.
-- seller_id remains the accountable human owner for edits/payouts; this
-- nullable FK controls the public organisation profile association.

alter table public.listings
  add column if not exists organisation_id uuid references public.organisations(id) on delete set null;

create index if not exists listings_organisation_id_idx
  on public.listings (organisation_id)
  where organisation_id is not null;
