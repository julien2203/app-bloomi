DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'listing_status'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'listing_status'
        AND e.enumlabel = 'reserved'
    ) THEN
      ALTER TYPE public.listing_status ADD VALUE 'reserved';
    END IF;
  END IF;
END
$$;

