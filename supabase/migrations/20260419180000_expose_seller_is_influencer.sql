-- Expose profiles.is_influencer sur les vues listing (feed + détail) pour badges UI.

begin;

drop view if exists public.v_feed_listings cascade;
drop view if exists public.v_listing_detail cascade;

create view public.v_feed_listings as
select
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  (select count(*)::int from public.likes lk where lk.listing_id = l.id) as likes_count,
  l.status,
  l.category,
  l.condition,
  l.delivery_mode,
  l.city,
  l.country_code,
  l.created_at,
  l.published_at,
  l.updated_at,
  lp_cover.url as cover_photo_url,
  lp_cover.order_index as cover_photo_order,
  p.display_name as seller_display_name,
  p.avatar_url as seller_avatar_url,
  coalesce(l.city, '') as listing_city,
  coalesce(l.country_code, p.country) as listing_country,
  l.is_sponsored,
  l.sponsored_until,
  l.sponsor_type,
  l.brand,
  l.size,
  l.color,
  l.latitude,
  l.longitude,
  coalesce(p.is_influencer, false) as seller_is_influencer
from public.listings l
inner join public.profiles p on l.seller_id = p.id
left join lateral (
  select url, order_index
  from public.listing_photos
  where listing_id = l.id
    and order_index = 0
  limit 1
) lp_cover on true
where l.status = 'published'
order by l.published_at desc nulls last, l.created_at desc;

grant select on public.v_feed_listings to authenticated;
grant select on public.v_feed_listings to anon;

create view public.v_listing_detail as
select
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  l.status,
  l.category,
  l.condition,
  l.delivery_mode,
  l.latitude,
  l.longitude,
  l.city,
  l.country_code,
  l.created_at,
  l.updated_at,
  l.published_at,
  l.sold_at,
  p.display_name as seller_display_name,
  p.avatar_url as seller_avatar_url,
  p.country as seller_country,
  coalesce(
    (
      select json_agg(
        json_build_object(
          'id', lp.id,
          'url', lp.url,
          'order_index', lp.order_index,
          'created_at', lp.created_at
        ) order by lp.order_index
      )
      from public.listing_photos lp
      where lp.listing_id = l.id
    ),
    '[]'::json
  ) as photos,
  l.brand,
  l.size,
  l.color,
  (
    select count(*)::int
    from public.listings l2
    where l2.seller_id = l.seller_id
      and l2.status = 'published'
  ) as seller_published_count,
  coalesce(p.is_influencer, false) as seller_is_influencer
from public.listings l
inner join public.profiles p on l.seller_id = p.id;

grant select on public.v_listing_detail to authenticated;
grant select on public.v_listing_detail to anon;

create or replace function public.nearby_feed_listings(
  p_lat float,
  p_lon float,
  p_radius_km float,
  p_limit int,
  p_offset int,
  p_section text default 'feed',
  p_query text default null,
  p_category text default null,
  p_conditions text[] default null,
  p_price_min numeric default null,
  p_price_max numeric default null,
  p_brands text[] default null,
  p_sizes text[] default null,
  p_colors text[] default null,
  p_influencer_ids uuid[] default null
)
returns setof public.v_feed_listings
language plpgsql
security invoker
stable
as $$
begin
  return query
  select v.*
  from public.v_feed_listings v
  where v.latitude is not null
    and v.longitude is not null
    and public.distance_km(v.latitude, v.longitude, p_lat, p_lon) <= p_radius_km
    and (p_category is null or v.category = p_category)
    and (p_conditions is null or v.condition = any(p_conditions))
    and (p_price_min is null or v.price >= p_price_min)
    and (p_price_max is null or v.price <= p_price_max)
    and (p_brands is null or v.brand = any(p_brands))
    and (p_sizes is null or v.size = any(p_sizes))
    and (p_colors is null or v.color = any(p_colors))
    and (
      p_section <> 'sponsored'
      or (v.is_sponsored = true and v.sponsored_until > now())
    )
    and (
      p_section <> 'trending'
      or v.created_at >= (now() - interval '7 days')
    )
    and (
      p_section <> 'influencer'
      or (p_influencer_ids is not null and v.seller_id = any(p_influencer_ids))
    )
    and (
      p_query is null
      or (
        v.title ilike ('%' || p_query || '%')
        or v.description ilike ('%' || p_query || '%')
        or coalesce(v.brand, '') ilike ('%' || p_query || '%')
      )
    )
  order by public.distance_km(v.latitude, v.longitude, p_lat, p_lon) asc, v.created_at desc
  limit greatest(p_limit, 0)
  offset greatest(p_offset, 0);
end;
$$;

grant execute on function public.nearby_feed_listings(
  float, float, float, int, int, text, text, text, text[], numeric, numeric, text[], text[], text[], uuid[]
) to anon, authenticated;

commit;
