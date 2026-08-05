-- Categories display order (client doc / CSV). sort_order is scoped per parent (roots per gender).

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_categories_parent_sort
  ON public.categories (parent_id, sort_order);

UPDATE public.categories SET sort_order = 1 WHERE id = 1; -- Clothing
UPDATE public.categories SET sort_order = 2 WHERE id = 2; -- Shoes
UPDATE public.categories SET sort_order = 3 WHERE id = 3; -- Bags
UPDATE public.categories SET sort_order = 4 WHERE id = 4; -- Accessories
UPDATE public.categories SET sort_order = 5 WHERE id = 5; -- Sport
UPDATE public.categories SET sort_order = 1 WHERE id = 6; -- Vintage
UPDATE public.categories SET sort_order = 2 WHERE id = 7; -- Designer & Luxury
UPDATE public.categories SET sort_order = 3 WHERE id = 8; -- Influencer picks
UPDATE public.categories SET sort_order = 6 WHERE id = 9; -- Other
UPDATE public.categories SET sort_order = 1 WHERE id = 10; -- Clothing
UPDATE public.categories SET sort_order = 2 WHERE id = 11; -- Shoes
UPDATE public.categories SET sort_order = 3 WHERE id = 12; -- Bags
UPDATE public.categories SET sort_order = 4 WHERE id = 13; -- Accessories
UPDATE public.categories SET sort_order = 5 WHERE id = 14; -- Sport
UPDATE public.categories SET sort_order = 1 WHERE id = 15; -- Vintage
UPDATE public.categories SET sort_order = 2 WHERE id = 16; -- Designer & Luxury
UPDATE public.categories SET sort_order = 3 WHERE id = 17; -- Influencer picks
UPDATE public.categories SET sort_order = 6 WHERE id = 18; -- Other items
UPDATE public.categories SET sort_order = 1 WHERE id = 19; -- Clothing
UPDATE public.categories SET sort_order = 2 WHERE id = 20; -- Shoes
UPDATE public.categories SET sort_order = 3 WHERE id = 21; -- Accessories
UPDATE public.categories SET sort_order = 4 WHERE id = 22; -- Baby care
UPDATE public.categories SET sort_order = 5 WHERE id = 23; -- Baby toys
UPDATE public.categories SET sort_order = 6 WHERE id = 24; -- Other items
UPDATE public.categories SET sort_order = 1 WHERE id = 25; -- Clothing
UPDATE public.categories SET sort_order = 2 WHERE id = 26; -- Shoes
UPDATE public.categories SET sort_order = 3 WHERE id = 27; -- Accessories
UPDATE public.categories SET sort_order = 4 WHERE id = 28; -- Toys & Leisure
UPDATE public.categories SET sort_order = 5 WHERE id = 29; -- Kids furniture
UPDATE public.categories SET sort_order = 6 WHERE id = 30; -- School
UPDATE public.categories SET sort_order = 1 WHERE id = 31; -- Dresses
UPDATE public.categories SET sort_order = 2 WHERE id = 32; -- Tops & T-shirts
UPDATE public.categories SET sort_order = 3 WHERE id = 33; -- Shirts & Blouses
UPDATE public.categories SET sort_order = 4 WHERE id = 34; -- Sweaters & Cardigans
UPDATE public.categories SET sort_order = 5 WHERE id = 35; -- Sweatshirts & Hoodies
UPDATE public.categories SET sort_order = 6 WHERE id = 36; -- Trousers & Pants
UPDATE public.categories SET sort_order = 7 WHERE id = 37; -- Jeans
UPDATE public.categories SET sort_order = 8 WHERE id = 38; -- Skirts
UPDATE public.categories SET sort_order = 9 WHERE id = 39; -- Shorts
UPDATE public.categories SET sort_order = 10 WHERE id = 40; -- Jumpsuits & Playsuits
UPDATE public.categories SET sort_order = 11 WHERE id = 41; -- Jackets
UPDATE public.categories SET sort_order = 12 WHERE id = 42; -- Coats
UPDATE public.categories SET sort_order = 13 WHERE id = 43; -- Blazers
UPDATE public.categories SET sort_order = 14 WHERE id = 44; -- Lingerie & Nightwear
UPDATE public.categories SET sort_order = 15 WHERE id = 45; -- Swimwear
UPDATE public.categories SET sort_order = 1 WHERE id = 46; -- Sneakers
UPDATE public.categories SET sort_order = 2 WHERE id = 47; -- Ankle boots
UPDATE public.categories SET sort_order = 3 WHERE id = 48; -- Boots
UPDATE public.categories SET sort_order = 4 WHERE id = 49; -- Pumps
UPDATE public.categories SET sort_order = 5 WHERE id = 50; -- Sandals
UPDATE public.categories SET sort_order = 6 WHERE id = 51; -- Loafers
UPDATE public.categories SET sort_order = 7 WHERE id = 52; -- Ballet flats
UPDATE public.categories SET sort_order = 8 WHERE id = 53; -- Flat shoes
UPDATE public.categories SET sort_order = 9 WHERE id = 54; -- Heeled shoes
UPDATE public.categories SET sort_order = 1 WHERE id = 55; -- Handbags
UPDATE public.categories SET sort_order = 2 WHERE id = 56; -- Crossbody bags
UPDATE public.categories SET sort_order = 3 WHERE id = 57; -- Totes
UPDATE public.categories SET sort_order = 4 WHERE id = 58; -- Backpacks
UPDATE public.categories SET sort_order = 5 WHERE id = 59; -- Clutches
UPDATE public.categories SET sort_order = 6 WHERE id = 60; -- Travel bags
UPDATE public.categories SET sort_order = 1 WHERE id = 61; -- Jewellery
UPDATE public.categories SET sort_order = 2 WHERE id = 62; -- Belts
UPDATE public.categories SET sort_order = 3 WHERE id = 63; -- Scarves & Shawls
UPDATE public.categories SET sort_order = 4 WHERE id = 64; -- Hats & Beanies
UPDATE public.categories SET sort_order = 5 WHERE id = 65; -- Glasses & Sunglasses
UPDATE public.categories SET sort_order = 6 WHERE id = 66; -- Gloves
UPDATE public.categories SET sort_order = 7 WHERE id = 67; -- Watches
UPDATE public.categories SET sort_order = 1 WHERE id = 68; -- Sportswear
UPDATE public.categories SET sort_order = 2 WHERE id = 69; -- Sports shoes
UPDATE public.categories SET sort_order = 3 WHERE id = 70; -- Sports accessories
UPDATE public.categories SET sort_order = 1 WHERE id = 75; -- T-shirts
UPDATE public.categories SET sort_order = 2 WHERE id = 76; -- Polo shirts
UPDATE public.categories SET sort_order = 3 WHERE id = 77; -- Shirts
UPDATE public.categories SET sort_order = 4 WHERE id = 78; -- Sweaters & Cardigans
UPDATE public.categories SET sort_order = 5 WHERE id = 79; -- Sweatshirts & Hoodies
UPDATE public.categories SET sort_order = 6 WHERE id = 80; -- Trousers & Pants
UPDATE public.categories SET sort_order = 7 WHERE id = 81; -- Jeans
UPDATE public.categories SET sort_order = 8 WHERE id = 82; -- Shorts
UPDATE public.categories SET sort_order = 9 WHERE id = 83; -- Suits
UPDATE public.categories SET sort_order = 10 WHERE id = 84; -- Jackets
UPDATE public.categories SET sort_order = 11 WHERE id = 85; -- Coats
UPDATE public.categories SET sort_order = 12 WHERE id = 86; -- Blazers
UPDATE public.categories SET sort_order = 13 WHERE id = 87; -- Underwear & Nightwear
UPDATE public.categories SET sort_order = 14 WHERE id = 88; -- Swimwear
UPDATE public.categories SET sort_order = 1 WHERE id = 89; -- Sneakers
UPDATE public.categories SET sort_order = 2 WHERE id = 90; -- Ankle boots
UPDATE public.categories SET sort_order = 3 WHERE id = 91; -- Boots
UPDATE public.categories SET sort_order = 4 WHERE id = 92; -- Dress shoes
UPDATE public.categories SET sort_order = 5 WHERE id = 93; -- Loafers
UPDATE public.categories SET sort_order = 6 WHERE id = 94; -- Sandals
UPDATE public.categories SET sort_order = 7 WHERE id = 95; -- Sports shoes
UPDATE public.categories SET sort_order = 1 WHERE id = 96; -- Backpacks
UPDATE public.categories SET sort_order = 2 WHERE id = 97; -- Crossbody bags
UPDATE public.categories SET sort_order = 3 WHERE id = 98; -- Sports bags
UPDATE public.categories SET sort_order = 4 WHERE id = 99; -- Travel bags
UPDATE public.categories SET sort_order = 5 WHERE id = 100; -- Messenger bags
UPDATE public.categories SET sort_order = 1 WHERE id = 101; -- Watches
UPDATE public.categories SET sort_order = 2 WHERE id = 102; -- Belts
UPDATE public.categories SET sort_order = 3 WHERE id = 103; -- Caps & Hats
UPDATE public.categories SET sort_order = 4 WHERE id = 104; -- Scarves
UPDATE public.categories SET sort_order = 5 WHERE id = 105; -- Gloves
UPDATE public.categories SET sort_order = 6 WHERE id = 106; -- Glasses & Sunglasses
UPDATE public.categories SET sort_order = 7 WHERE id = 107; -- Wallets
UPDATE public.categories SET sort_order = 1 WHERE id = 108; -- Sportswear
UPDATE public.categories SET sort_order = 2 WHERE id = 109; -- Sports shoes
UPDATE public.categories SET sort_order = 3 WHERE id = 110; -- Sports accessories
UPDATE public.categories SET sort_order = 1 WHERE id = 115; -- Bodysuits
UPDATE public.categories SET sort_order = 2 WHERE id = 116; -- Pyjamas & Sleepsuits
UPDATE public.categories SET sort_order = 3 WHERE id = 117; -- T-shirts & Tops
UPDATE public.categories SET sort_order = 4 WHERE id = 118; -- Sweaters & Cardigans
UPDATE public.categories SET sort_order = 5 WHERE id = 119; -- Trousers & Leggings
UPDATE public.categories SET sort_order = 6 WHERE id = 120; -- Sets & Outfits
UPDATE public.categories SET sort_order = 7 WHERE id = 121; -- Jumpsuits & Rompers
UPDATE public.categories SET sort_order = 8 WHERE id = 122; -- Jackets & Coats
UPDATE public.categories SET sort_order = 9 WHERE id = 123; -- Swimwear
UPDATE public.categories SET sort_order = 1 WHERE id = 124; -- Booties & Soft shoes
UPDATE public.categories SET sort_order = 2 WHERE id = 125; -- First walkers
UPDATE public.categories SET sort_order = 1 WHERE id = 126; -- Beanies & Hats
UPDATE public.categories SET sort_order = 2 WHERE id = 127; -- Sun hats
UPDATE public.categories SET sort_order = 3 WHERE id = 128; -- Bibs
UPDATE public.categories SET sort_order = 4 WHERE id = 129; -- Socks
UPDATE public.categories SET sort_order = 5 WHERE id = 130; -- Mittens
UPDATE public.categories SET sort_order = 6 WHERE id = 131; -- Sleeping bags
UPDATE public.categories SET sort_order = 1 WHERE id = 132; -- Strollers & Pushchairs
UPDATE public.categories SET sort_order = 2 WHERE id = 133; -- Baby carriers
UPDATE public.categories SET sort_order = 3 WHERE id = 134; -- Car seats
UPDATE public.categories SET sort_order = 4 WHERE id = 135; -- Bouncers & Rockers
UPDATE public.categories SET sort_order = 5 WHERE id = 136; -- High chairs
UPDATE public.categories SET sort_order = 6 WHERE id = 137; -- Cots & Cribs
UPDATE public.categories SET sort_order = 7 WHERE id = 138; -- Mattresses
UPDATE public.categories SET sort_order = 1 WHERE id = 139; -- Activity & Sensory toys
UPDATE public.categories SET sort_order = 2 WHERE id = 140; -- Soft toys & Plushies
UPDATE public.categories SET sort_order = 3 WHERE id = 141; -- Baby books
UPDATE public.categories SET sort_order = 1 WHERE id = 142; -- Newborn gift sets
UPDATE public.categories SET sort_order = 2 WHERE id = 143; -- Other items
UPDATE public.categories SET sort_order = 1 WHERE id = 144; -- T-shirts
UPDATE public.categories SET sort_order = 2 WHERE id = 145; -- Tops
UPDATE public.categories SET sort_order = 3 WHERE id = 146; -- Sweaters & Cardigans
UPDATE public.categories SET sort_order = 4 WHERE id = 147; -- Sweatshirts & Hoodies
UPDATE public.categories SET sort_order = 5 WHERE id = 148; -- Trousers & Pants
UPDATE public.categories SET sort_order = 6 WHERE id = 149; -- Jeans
UPDATE public.categories SET sort_order = 7 WHERE id = 150; -- Shorts
UPDATE public.categories SET sort_order = 8 WHERE id = 151; -- Skirts
UPDATE public.categories SET sort_order = 9 WHERE id = 152; -- Dresses
UPDATE public.categories SET sort_order = 10 WHERE id = 153; -- Sets & Outfits
UPDATE public.categories SET sort_order = 11 WHERE id = 154; -- Jackets
UPDATE public.categories SET sort_order = 12 WHERE id = 155; -- Coats
UPDATE public.categories SET sort_order = 13 WHERE id = 156; -- Pyjamas
UPDATE public.categories SET sort_order = 14 WHERE id = 157; -- Underwear
UPDATE public.categories SET sort_order = 15 WHERE id = 158; -- Swimwear
UPDATE public.categories SET sort_order = 1 WHERE id = 159; -- Sneakers
UPDATE public.categories SET sort_order = 2 WHERE id = 160; -- Ankle boots
UPDATE public.categories SET sort_order = 3 WHERE id = 161; -- Boots
UPDATE public.categories SET sort_order = 4 WHERE id = 162; -- Sandals
UPDATE public.categories SET sort_order = 5 WHERE id = 163; -- Sports shoes
UPDATE public.categories SET sort_order = 6 WHERE id = 164; -- Slippers & Soft shoes
UPDATE public.categories SET sort_order = 1 WHERE id = 165; -- Bags & School bags
UPDATE public.categories SET sort_order = 2 WHERE id = 166; -- Hats & Caps
UPDATE public.categories SET sort_order = 3 WHERE id = 167; -- Scarves
UPDATE public.categories SET sort_order = 4 WHERE id = 168; -- Gloves
UPDATE public.categories SET sort_order = 5 WHERE id = 169; -- Socks
UPDATE public.categories SET sort_order = 1 WHERE id = 170; -- Educational games
UPDATE public.categories SET sort_order = 2 WHERE id = 171; -- Board games
UPDATE public.categories SET sort_order = 3 WHERE id = 172; -- Outdoor toys
UPDATE public.categories SET sort_order = 4 WHERE id = 173; -- Children's books
UPDATE public.categories SET sort_order = 1 WHERE id = 174; -- Beds
UPDATE public.categories SET sort_order = 2 WHERE id = 175; -- Desks
UPDATE public.categories SET sort_order = 3 WHERE id = 176; -- Chairs
UPDATE public.categories SET sort_order = 4 WHERE id = 177; -- Storage
UPDATE public.categories SET sort_order = 1 WHERE id = 178; -- School supplies
UPDATE public.categories SET sort_order = 2 WHERE id = 179; -- School bags
UPDATE public.categories SET sort_order = 4 WHERE id = 180; -- Other items
UPDATE public.categories SET sort_order = 4 WHERE id = 181; -- Other items
