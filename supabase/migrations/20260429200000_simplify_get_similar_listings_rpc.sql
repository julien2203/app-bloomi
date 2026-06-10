begin;

create or replace function public.get_similar_listings(
  p_listing_id uuid,
  p_limit int default 6
)
returns setof public.v_listing_detail
language sql
stable
security invoker
as $$
with
base_context as (
  select
    l.id,
    l.seller_id,
    l.category_id as base_category_id,
    c.gender as base_gender
  from public.listings l
  join public.categories c on c.id = l.category_id
  where l.id = p_listing_id
),
strict_matches as (
  select l.id
  from public.listings l
  cross join base_context bc
  join public.categories cc on cc.id = l.category_id
  where l.status = 'published'
    and l.id <> p_listing_id
    and l.seller_id <> bc.seller_id
    and l.category_id = bc.base_category_id
    and cc.gender = bc.base_gender
)
select vd.*
from strict_matches s
join public.v_listing_detail vd on vd.id = s.id
where vd.status = 'published'
order by vd.created_at desc
limit greatest(coalesce(p_limit, 6), 0);
$$;

grant execute on function public.get_similar_listings(uuid, int) to anon, authenticated;

commit;
