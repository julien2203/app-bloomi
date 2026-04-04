alter table public.orders
  add column if not exists listing_title text,
  add column if not exists listing_price numeric,
  add column if not exists listing_cover_photo_url text;

