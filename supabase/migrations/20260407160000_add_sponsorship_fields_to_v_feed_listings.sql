-- Add sponsorship fields to v_feed_listings so feed can filter cleanly.
-- This keeps the feed queries fast and simple (single view).

create or replace view public.v_feed_listings as
select
  l.id,
  l.seller_id,
  l.title,
  l.description,
  l.price,
  -- Likes count (instant display)
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
  -- Cover photo (order_index=0)
  lp_cover.url as cover_photo_url,
  lp_cover.order_index as cover_photo_order,
  -- Seller info minimal
  p.display_name as seller_display_name,
  p.avatar_url as seller_avatar_url,
  -- Seller location (from profile or listing)
  coalesce(l.city, '') as listing_city,
  coalesce(l.country_code, p.country) as listing_country,
  -- Sponsorship (added at the end to preserve existing column order)
  l.is_sponsored,
  l.sponsored_until,
  l.sponsor_type
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

