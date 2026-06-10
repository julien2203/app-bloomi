ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS parcel_size text
CHECK (parcel_size IN ('small', 'large', 'xlarge'));
