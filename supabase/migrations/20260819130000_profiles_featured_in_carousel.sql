-- Add featured_in_carousel flag to profiles
-- Controls which influencers appear in fixed positions (cards 2-8) of the feed carousel.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS featured_in_carousel boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.featured_in_carousel IS
  'When true, this influencer appears in fixed positions (2-8) of the feed spotlight carousel.';
