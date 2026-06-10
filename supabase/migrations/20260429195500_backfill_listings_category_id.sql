begin;

-- Backfill category_id for existing listings that only stored category text.
update public.listings l
set category_id = resolved.category_id
from (
  select
    lx.id,
    coalesce(
      (
        select c.id
        from public.categories c
        where lower(c.slug) = lower(trim(coalesce(lx.category, '')))
        limit 1
      ),
      (
        select c.id
        from public.categories c
        where lower(c.name) = lower(trim(coalesce(lx.category, '')))
        limit 1
      )
    ) as category_id
  from public.listings lx
  where lx.category_id is null
    and nullif(trim(coalesce(lx.category, '')), '') is not null
) as resolved
where l.id = resolved.id
  and resolved.category_id is not null
  and l.category_id is null;

create index if not exists listings_category_id_published_idx
  on public.listings(category_id)
  where status = 'published';

commit;
