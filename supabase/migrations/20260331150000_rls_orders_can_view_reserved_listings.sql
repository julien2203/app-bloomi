DO $$
BEGIN
  -- LISTINGS: allow buyers/sellers of an order to SELECT the listing (even if reserved/sold)
  EXECUTE $sql$
    CREATE POLICY "Order participants can view ordered listings"
      ON public.listings
      FOR SELECT
      USING (
        status = 'published'
        OR seller_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.listing_id = listings.id
            AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
        )
      );
  $sql$;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

DO $$
BEGIN
  -- LISTING_PHOTOS: allow buyers/sellers of an order to SELECT photos for that listing
  EXECUTE $sql$
    CREATE POLICY "Order participants can view ordered listing photos"
      ON public.listing_photos
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.listings l
          WHERE l.id = listing_photos.listing_id
            AND (l.status = 'published' OR l.seller_id = auth.uid())
        )
        OR EXISTS (
          SELECT 1
          FROM public.orders o
          WHERE o.listing_id = listing_photos.listing_id
            AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
        )
      );
  $sql$;
EXCEPTION
  WHEN duplicate_object THEN
    NULL;
END
$$;

