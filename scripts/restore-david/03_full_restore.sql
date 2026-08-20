-- Restore David Henninger — PROD only
-- user: 069f6607-b95e-4a32-9d2f-351124be9a56 / davidhenninger1@gmail.com
-- Contenu : auth.users + auth.identities + public.profiles + 23 listings + photos
-- ÉTAPE 0 : supprimer le compte Google vide avant d'exécuter ce script
--   DELETE FROM public.profiles WHERE id = '7e782c50-5314-4918-b710-db51f604d1fc';
--   DELETE FROM auth.identities WHERE user_id = '7e782c50-5314-4918-b710-db51f604d1fc';
--   DELETE FROM auth.users WHERE id = '7e782c50-5314-4918-b710-db51f604d1fc';

BEGIN;

-- ─────────────────────────────────────────────
-- 1. auth.users
-- ─────────────────────────────────────────────
INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  'authenticated',
  'authenticated',
  'davidhenninger1@gmail.com',
  '$2a$10$3/xSV70ZC219tTkHWf1Q1OnOBnY2HAibQofbOPQNTt5V/rag89bm2',
  '2026-07-06 16:43:05.949806+00',
  NULL,
  '',
  '2026-07-06 16:42:39.474295+00',
  '',
  NULL,
  '',
  '',
  NULL,
  '2026-07-06 16:52:43.207234+00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"sub":"069f6607-b95e-4a32-9d2f-351124be9a56","email":"davidhenninger1@gmail.com","username":"okamarkt","full_name":"David Henninger","user_type":"selling","email_verified":true,"phone_verified":false,"marketing_optin":false}'::jsonb,
  NULL,
  '2026-07-06 16:42:39.461357+00',
  '2026-07-25 09:24:29.472786+00',
  NULL,
  NULL,
  '',
  '',
  NULL,
  '',
  0,
  NULL,
  '',
  NULL,
  false,
  NULL,
  false
);

-- ─────────────────────────────────────────────
-- 2. auth.identities
-- ─────────────────────────────────────────────
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at, id) VALUES (
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  '{"sub":"069f6607-b95e-4a32-9d2f-351124be9a56","email":"davidhenninger1@gmail.com","username":"okamarkt","full_name":"David Henninger","user_type":"selling","email_verified":true,"phone_verified":false,"marketing_optin":false}'::jsonb,
  'email',
  '2026-07-06 16:42:39.46888+00',
  '2026-07-06 16:42:39.468927+00',
  '2026-07-06 16:42:39.468927+00',
  'f35c5eff-e8a5-46af-b76b-5c8942b69205'
);

-- ─────────────────────────────────────────────
-- 3. public.profiles
-- ─────────────────────────────────────────────
INSERT INTO public.profiles (id, phone, country, created_at, display_name, avatar_url, updated_at, bio, about, location, location_visible, vacation_mode, company_name, ide_number, company_address, company_social, stripe_account_id, stripe_onboarding_complete, stripe_seller_account_id, stripe_connect_onboarding_completed, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_created_at, city, latitude, longitude, expo_push_token, average_rating, reviews_count, cover_image, is_influencer_request, influencer_request_at, gender, birth_date, street, postal_code, is_influencer, push_notification_settings, is_admin, language, influencer_instagram, seller_type, work_street, work_postal_code, work_city, work_country, address_first_name, address_last_name) VALUES (
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  '',
  'CH',
  '2026-07-06 16:43:40.52934+00',
  'okamarkt',
  'https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/avatars/069f6607-b95e-4a32-9d2f-351124be9a56/1783357498763.jpg',
  '2026-07-25 09:24:30.563069+00',
  NULL,
  NULL,
  NULL,
  false,
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  'acct_1TqFtbEIoZhw39ou',
  false,
  'acct_1TqFtbEIoZhw39ou',
  true,
  false,
  false,
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  'ExponentPushToken[PhYldKHfhh9Yi7XyNPpUAT]',
  0.00,
  0,
  'https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/cover/069f6607-b95e-4a32-9d2f-351124be9a56/cover-1783363889640.jpg',
  false,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  false,
  '{"enabled":true,"newItems":true,"newMessage":true,"newFeedback":true,"newFollowers":true,"favoriteItems":true}'::jsonb,
  false,
  'en',
  NULL,
  'individual',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
);

-- ─────────────────────────────────────────────
-- 4. listings (23 annonces)
-- ─────────────────────────────────────────────
INSERT INTO public.listings (id, seller_id, title, description, price, status, category, condition, delivery_mode, latitude, longitude, city, country_code, created_at, updated_at, published_at, sold_at, brand, size, color, views_count, category_id, brand_id, size_id, country, is_sponsored, sponsored_until, sponsor_type, parcel_size, pickup_primary_street, pickup_primary_postal_code, pickup_primary_city, pickup_work_street, pickup_work_postal_code, pickup_work_city) VALUES
('9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01','069f6607-b95e-4a32-9d2f-351124be9a56','Bag Aplino premium leatherette duffle bag','Brand : DH

Looking for a stylish and functional travel companion? The Bag Aplino by DH is a classy, discreet travel bag designed for both everyday use and weekend getaways.

Key Features:
✅ Shoulder strap included – Comfortable and adjustable for easy carrying
✅ Elegant & minimalist design – Perfec',40.00,'published','Travel bags',NULL,'shipping',NULL,NULL,NULL,'CH','2026-07-06 17:06:34.661632+00','2026-07-06 17:06:48.643368+00','2026-07-06 17:06:48.359+00',NULL,NULL,NULL,NULL,0,99,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('e250df79-884c-4195-b90a-b21028e79ae8','069f6607-b95e-4a32-9d2f-351124be9a56','Converse Chuck Taylor All Star Lift High – White – Size 36 (',NULL,16.00,'published','Sneakers','fair','shipping',NULL,NULL,NULL,'CH','2026-07-06 18:40:42.431738+00','2026-07-06 18:41:04.654678+00','2026-07-06 18:41:04.435+00',NULL,'Converse','EU 36',NULL,0,46,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('86942594-a783-49e7-bc1e-3d12be0ff00e','069f6607-b95e-4a32-9d2f-351124be9a56','AM by Dosenbach Men''s Shoes Size 43 – Beige Suede Casual Sne','Description
Stylish men''s shoes by AM by Dosenbach in a beige/taupe suede-look finish with cream soles and dark blue lace details.

The shoes have been worn but remain in overall good used condition. Minor signs of wear from normal use are present on the soles and material (see photos for exact cond',21.00,'published','Dress shoes','fair','shipping',NULL,NULL,NULL,'CH','2026-07-06 18:46:15.504691+00','2026-07-06 18:46:41.516672+00','2026-07-06 18:46:41.287+00',NULL,NULL,'EU 43','Beige',0,92,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('0760222b-6b67-4a32-8de8-8f6113deb73b','069f6607-b95e-4a32-9d2f-351124be9a56','Nike Air Force 1 Low Multicolor Sneakers – Women''s EU Size 3','Description:

Stylish Nike Air Force 1 Low sneakers featuring a unique multicolor design with mixed materials and standout detailing. Pre-owned and in used condition with visible signs of wear from normal use. Please review all photos carefully for the exact condition and details. A rare and eye-cat',30.00,'published','Sneakers','fair','shipping',NULL,NULL,NULL,'CH','2026-07-06 18:55:47.127215+00','2026-07-06 18:56:59.016756+00','2026-07-06 18:56:06.235+00',NULL,'Nike','EU 36',NULL,0,46,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('9d08c378-fb3c-4118-a0bb-76af13ffa59e','069f6607-b95e-4a32-9d2f-351124be9a56','PIED de BICHE Paris Red Patent Leather Slingback Pumps with','Brand: PIED de BICHE Paris
Size: EU 37
Color: Red
Material: Patent leather (leather upper with glossy finish)
Style: Slingback ballet pumps
Detail: Decorative bow on toe
Heel: Low block heel
Closure: Adjustable slingback strap
Made in Portugal',80.00,'published','Heeled shoes','good','both',NULL,NULL,NULL,'CH','2026-07-06 19:02:27.799433+00','2026-07-06 19:02:46.250953+00','2026-07-06 19:02:46.031+00',NULL,'Other','EU 37','Red',0,54,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('ae0974b9-a4ee-4f95-b06c-890cb1f596c6','069f6607-b95e-4a32-9d2f-351124be9a56','COS Bay Barrel-Leg Jeans in Mid Blue – Size 27','Regular fit
Mid-rise waist
Barrel-leg silhouette
Ankle length
Classic mid-blue wash
Button and zip fastening
Heavyweight 12.8oz denim
Composition

Shell: 80% Organic cotton, 20% Recycled cotton
Lining: 65% Recycled polyester, 35% Organic cotton

Condition
Pre-owned / gently worn and in excellent co',100.00,'published','Jeans','good','shipping',NULL,NULL,NULL,'CH','2026-07-06 19:14:15.571472+00','2026-07-06 19:14:34.420272+00','2026-07-06 19:14:34.192+00',NULL,'COS','M (38–40)','Blue',0,37,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','069f6607-b95e-4a32-9d2f-351124be9a56','Men''s Vintage Leather Wallet','Carry history in your pocket. This men''s vintage leather wallet blends rugged charm with everyday function. Made from premium genuine cowhide, it features a timeworn patina that only improves with age — a true testament to its craftsmanship and character.

✅ New without tag',30.00,'published','Wallets','like_new','shipping',NULL,NULL,NULL,'CH','2026-07-06 19:23:43.174612+00','2026-07-07 05:55:44.213961+00','2026-07-06 19:24:12.476+00',NULL,NULL,NULL,'Brown',0,107,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('3a53990e-6fe0-44ed-bc86-724b1c179cbd','069f6607-b95e-4a32-9d2f-351124be9a56','Men''s 100% Cotton T-Shirt – Grey Crew Neck','Features:
100% cotton
Soft, breathable knit fabric
Classic crew neck
Short sleeves
Regular fit
Slight stretch for added comfort
Durable construction for everyday wear
XL (EU)
Machine washable , used perfect state',10.00,'published','T-shirts','good','shipping',NULL,NULL,NULL,'CH','2026-07-07 19:37:02.494715+00','2026-07-07 19:37:06.438722+00','2026-07-07 19:37:06.223+00',NULL,NULL,'XL (52)','Gray',0,75,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('045e7ad5-ceb3-4097-8da7-8e68dc6fccf1','069f6607-b95e-4a32-9d2f-351124be9a56','COS Twill Tapered Trousers in Beige – TENCEL™ Lyocell Blend','Details
Brand: COS
Model: Twill Tapered Trousers
Color: Beige / Sand
Size: EUR 54 (CN 180/98A)
Fit: Regular fit with slightly tapered leg
Material:
65% TENCEL™ Lyocell
35% BCI Cotton
Elasticated waistband
Size corresponding more to XL
Front and back pockets
Made in Turkey / Türkiye
Slightly worn,',90.00,'published','Trousers & Pants','good','shipping',NULL,NULL,NULL,'CH','2026-07-07 19:41:29.316783+00','2026-07-08 11:00:24.517851+00','2026-07-07 19:41:32.542+00',NULL,'COS','XXL (54)','Beige',0,80,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('c301f604-11a9-48ff-86ff-a79233f2dd61','069f6607-b95e-4a32-9d2f-351124be9a56','BIKINI BALI – DH Final Sale (size M only)','💸 Price includes both top and bottom (2 pieces).

🌿 Composition :
EU Fabric: 88% recycled polyester, 12% elastane – 230 g/m²
MX Fabric: 81% REPREVE® recycled polyester, 19% LYCRA® XTRA LIFE™ – 255 g/m²
Double-layered, non-reversible
Removable padding

New never worn',29.00,'published','Swimwear','like_new','shipping',NULL,NULL,NULL,'CH','2026-07-07 19:32:50.476015+00','2026-07-07 19:42:03.049472+00','2026-07-07 19:32:54.349+00',NULL,NULL,'M (38–40)','Black',0,45,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('0d5e5eb8-e1e7-4f3d-9755-529b1990418b','069f6607-b95e-4a32-9d2f-351124be9a56','Made in Italy Women''s Blue One-Piece Swimsuit','Condition:
• Pre-owned / worn
• Like new condition
• Very well maintained
• Please check all photos carefully
Details:
• Made in Italy
• Size: 40 (IT)
• Color: Blue
• Material: 80% Polyester, 20% Elastane
• Soft and comfortable stretch fabric
• Fully lined
• Classic and timeless design',20.00,'published','Swimwear','good','shipping',NULL,NULL,NULL,'CH','2026-07-07 19:45:51.844188+00','2026-07-07 19:45:54.993454+00','2026-07-07 19:45:54.833+00',NULL,NULL,'S (36)','Blue',0,45,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('3d52377a-107f-48cb-8bf2-5aaeae59bf58','069f6607-b95e-4a32-9d2f-351124be9a56','COS Striped Wool Cropped Cardigan','Brand: COS
Size: XS (EUR)
CN Size: 160/80A
Material: 100% Wool
Color: Cream / Black Stripes
Made in China
O/N: 233357
P/N: 1269840 1
Condition:

Used / worn
Excellent condition
Please check photos for details',70.00,'published','Sweaters & Cardigans','good','shipping',NULL,NULL,NULL,'CH','2026-07-08 11:43:54.034869+00','2026-07-08 11:43:57.386169+00','2026-07-08 11:43:57.11+00',NULL,'COS','XS (34)','White',0,34,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('29b525b2-e722-4ef3-9425-70f2d1b0050f','069f6607-b95e-4a32-9d2f-351124be9a56','Diesel Blue Long Sleeve Stretch Top','Brand: Diesel
Size: Suggested EUR S
Color: Royal Blue
Style: Fitted Long Sleeve Top
Condition: Used / Worn – Please check photos for details
Material: Likely polyester-elastane blend or stretch technical fabric (exact composition unknown)
Features: Soft stretch fabric, crew neckline, embroidered Die',10.00,'published','Sweaters & Cardigans','fair','shipping',NULL,NULL,NULL,'CH','2026-07-08 11:47:57.299401+00','2026-07-08 11:48:00.417997+00','2026-07-08 11:48:00.15+00',NULL,NULL,'S (36)','Blue',0,34,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('b6f94ff7-43c3-46d7-a787-1d629f63dbca','069f6607-b95e-4a32-9d2f-351124be9a56','Zara Grey Short Sleeve Turtleneck Knit Top','Brand: Zara
Size: EUR M
Color: Grey
Condition: Pre-owned, good condition
Material: 83% Viscose, 15% Nylon, 2% Elastane
Style: Short sleeve turtleneck knit top
Made in: Cambodia
Soft, comfortable stretch fabric
Please check photos for details',10.00,'published','Tops & T-shirts','good','shipping',NULL,NULL,NULL,'CH','2026-07-08 11:50:02.817849+00','2026-07-08 11:50:06.571393+00','2026-07-08 11:50:06.299+00',NULL,'Zara','M (38–40)','Gray',0,32,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('b3ee840e-d212-4b64-b8c3-792eb35d94e5','069f6607-b95e-4a32-9d2f-351124be9a56','Women''s Cream Openwork Knit Top – Size M (Approx.)','Pre-owned cream knit top in good condition. Features an elegant openwork leaf-pattern design across the neckline and shoulders with relaxed short sleeves. Size estimated as EU M (please check measurements and photos). Material unknown, likely a soft knit blend. Please review all pictures for conditi',10.00,'published','Tops & T-shirts',NULL,'shipping',NULL,NULL,NULL,'CH','2026-07-08 11:51:46.491578+00','2026-07-08 11:51:49.999797+00','2026-07-08 11:51:49.739+00',NULL,NULL,'M (38–40)','White',0,32,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('3649130a-e6bf-4fa1-93d4-998c09aadb8b','069f6607-b95e-4a32-9d2f-351124be9a56','H&M Light Blue Cotton Shirt','Condition: Pre-owned / worn, good condition. Please check the photos for details.

Details:

Brand: H&M
Size: 34 (EU)
Color: Light Blue
Material: 100% Cotton
Made in Indonesia
Long sleeves
Button-front closure',10.00,'published','Shirts & Blouses','fair','shipping',NULL,NULL,NULL,'CH','2026-07-08 11:54:19.854634+00','2026-07-08 11:54:22.972321+00','2026-07-08 11:54:22.731+00',NULL,'H&M','XS (34)','Blue',0,33,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f','069f6607-b95e-4a32-9d2f-351124be9a56','H&M Grey Ribbed Top','Condition: Pre-owned / worn, good condition. Please check photos for details.

Details:

Brand: H&M
Size: S (EUR)
Color: Grey
Material: 95% Polyester, 5% Elastane
Made in China
Ribbed stretch fabric
Short sleeves
Comfortable fitted design',10.00,'published','Tops & T-shirts','fair','shipping',NULL,NULL,NULL,'CH','2026-07-08 11:56:12.093072+00','2026-07-08 11:56:15.455987+00','2026-07-08 11:56:15.199+00',NULL,'H&M','S (36)','Gray',0,32,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('614d4526-3eda-495a-866b-774878efcefd','069f6607-b95e-4a32-9d2f-351124be9a56','Condition: Pre-owned / worn, good condition. Please check ph','Condition:
• Pre-owned / used Details:
• Brand: Babaton
• Size: M
• Color: Green
• Made in Sri Lanka
• Material: 55% Linen, 45% Lenzing™ Viscose
• Button-front closure
• Long sleeves
• Relaxed fit
• Lightweight and breathable fabric',10.00,'published','Shirts & Blouses','fair','shipping',NULL,NULL,NULL,'CH','2026-07-08 11:59:02.204479+00','2026-07-08 11:59:05.90154+00','2026-07-08 11:59:05.625+00',NULL,NULL,'M (38–40)','Green',0,33,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('23065b9f-edbc-4a0e-8ac9-187e4ace87b9','069f6607-b95e-4a32-9d2f-351124be9a56','Zara Dark Green Midi Dress','Details:

Brand: Zara
Size: M (EU)
Color: Dark Green
Short sleeves
Mock neck / high neckline
Figure-hugging fit
Material: 95% Cotton, 5% Elastane
Made in Bangladesh
Condition: Used, but in perfect condition. No stains, holes, tears, or visible signs of wear.',18.00,'published','Dresses','fair','shipping',NULL,NULL,NULL,'CH','2026-07-08 12:07:09.031113+00','2026-07-08 12:07:13.092127+00','2026-07-08 12:07:12.786+00',NULL,'Zara','M (38–40)','Khaki green, Green',0,31,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('9335f3e0-857a-4303-bce4-b9ff7fb2b41e','069f6607-b95e-4a32-9d2f-351124be9a56','Details:  Brand: Zara Size: M (EU) Color: Dark Green Short s','Color: Black
Brand: H&M
Size: S
Short flutter sleeves
V-neck with decorative buttons
Tie-front detail at the hem
Lightweight, slightly sheer fabric
Comfortable and flattering fit
Made in Cambodia
99% polyester - 1% elastane
Condition: Used but in excellent condition. No stains, holes, tears, or noti',10.00,'published','Tops & T-shirts','good','shipping',NULL,NULL,NULL,'CH','2026-07-08 12:20:14.813352+00','2026-07-08 12:20:47.462144+00','2026-07-08 12:20:17.807+00',NULL,'Zara','S (36)','Black',0,32,NULL,NULL,NULL,false,NULL,NULL,'letter_aplus',NULL,NULL,NULL,NULL,NULL,NULL),
('f2df2f07-22a3-41b0-907a-24004fccc593','069f6607-b95e-4a32-9d2f-351124be9a56','Elegant black lace blouse from Zara','Condition:
• Pre-owned / worn
• Good condition
• Normal signs of wear from regular use
• Please review all photos carefully

Details:
• Brand: Zara
• Size: M
• Color: Black
• Floral lace fabric
• Long sleeves
• Button-front closure
• Semi-sheer design',10.00,'published','Shirts & Blouses','fair','shipping',NULL,NULL,NULL,'CH','2026-07-08 12:22:59.79449+00','2026-07-08 12:23:03.018893+00','2026-07-08 12:23:02.789+00',NULL,'Zara','M (38–40)','Black',0,33,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('facb30a7-7f65-4902-9cef-1d01fc814adb','069f6607-b95e-4a32-9d2f-351124be9a56','Patagonia Women''s Sherpa Fleece Vest Beige/Taupe','Details
Brand: Patagonia
Size: M
Color code: SBDY
Season: FA25 (Fall 2025)
Style reference: STY25217FA25
PO: 483851
RN#: 51884
Made in Vietnam
Composition
Body: 100% recycled polyester
Lining: 100% recycled polyester
Exclusive of trim. Great condition and ready to wear. Ideal for hiking, everyday we',99.00,'published','Jackets','good','shipping',NULL,NULL,NULL,'CH','2026-07-08 12:26:27.272726+00','2026-07-08 12:26:32.139471+00','2026-07-08 12:26:31.977+00',NULL,NULL,'M (38–40)','Beige, Gray',0,41,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('66a30509-731b-4a8e-a9b8-6a6c08b71512','069f6607-b95e-4a32-9d2f-351124be9a56','Acuitis Round Sunglasses – Blue Lenses & Silver Frame','Lens size: 45 mm
Bridge: 20 mm
Temple length: 140 mm
Color: Blue & Silver
Certification: CE
The glasses case is included
Condition: Used, in very good condition – clean and well maintained.',90.00,'published','Glasses & Sunglasses','good','shipping',NULL,NULL,NULL,'CH','2026-07-09 19:02:55.60767+00','2026-07-09 19:02:58.623875+00','2026-07-09 19:02:58.365+00',NULL,NULL,NULL,'Gray',0,65,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('71bb828c-1278-47ea-a94c-72c7837b5d97','069f6607-b95e-4a32-9d2f-351124be9a56','COS Oversized Suede Sherif Bag – Dark Brown Slouchy Hobo Sho','A timeless COS design that fits perfectly within a modern minimalist wardrobe.

📏 Approximate Dimensions
Length: 35 cm
Width: 19 cm
Height (with handle): 73 cm
🔍 Details
Brand: COS
Material: Suede / nubuck leather
Color: Dark brown
Made in Turkey
Style: Oversized tote / hobo bag
Closure: Open top',95.00,'published','Handbags','fair','shipping',NULL,NULL,NULL,'CH','2026-07-09 18:57:12.359949+00','2026-07-09 18:57:18.608326+00','2026-07-09 18:57:18.456+00',NULL,'COS',NULL,'Brown',0,55,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('0a272772-34c4-40b6-a436-6e35dc93c7b8','069f6607-b95e-4a32-9d2f-351124be9a56','Watch Princess of the Seas by David Henninger','Japanese quartz movement
Water resistance (3ATM/BAR)
Bracelet (stainless steel, Milanese, adjustable)
2 case sizes (40mm/36mm diameter, alloy)
The watch is new (End of series)
Final sale without guarantee New with box and tag',50.00,'published','Watches','new','shipping',NULL,NULL,NULL,'CH','2026-07-09 18:59:42.487978+00','2026-07-10 06:35:50.409282+00','2026-07-09 18:59:44.62+00',NULL,NULL,NULL,'Gold',0,67,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL),
('3c09c3c7-060e-4604-96cb-679cf20161ec','069f6607-b95e-4a32-9d2f-351124be9a56','Tissot PRC 200 Chronograph Quartz – Ref. T067417 – New Batte','Description
For sale is a Tissot PRC 200 Chronograph quartz, reference T067417.

Age: approx. 12 years
Condition: good used condition
Movement: quartz chronograph – working perfectly
40 mm dial case diameter
Battery: newly replaced
Cleaning: watch has been fully cleaned
Glass: sapphire crystal Loop',265.00,'published','Watches','fair','shipping',NULL,NULL,NULL,'CH','2026-07-23 20:32:16.371137+00','2026-07-23 20:39:32.596812+00','2026-07-23 20:32:24.466+00',NULL,NULL,NULL,NULL,0,101,NULL,NULL,NULL,false,NULL,NULL,'small',NULL,NULL,NULL,NULL,NULL,NULL);

-- ─────────────────────────────────────────────
-- 5. listing_photos (114 photos)
-- ─────────────────────────────────────────────
INSERT INTO public.listing_photos (id, listing_id, url, order_index, created_at) VALUES
('bdd4ae19-1756-46fb-af18-8a277369c2ed','9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01/photo-0-1783357594545-he5s2f.png',0,'2026-07-06 17:06:35.875413+00'),
('be6d4980-baac-4285-8f79-dcef74deb219','9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01/photo-1-1783357595737-m33bwf.jpg',1,'2026-07-06 17:06:36.552323+00'),
('1a0e13ba-ca2a-4df0-a8a9-8806e066a375','9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01/photo-2-1783357596411-48opwq.jpg',2,'2026-07-06 17:06:36.952403+00'),
('a08bb771-cdf3-484b-b227-e4c3fbaaefbf','9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01/photo-3-1783357596808-ho7aio.jpg',3,'2026-07-06 17:06:37.920639+00'),
('b2f6311f-ad52-4dc5-8ef0-557f16de65d9','9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9729c6ed-8cc0-4ea9-a37f-d92a7c01fe01/photo-4-1783357597782-w61qw0.png',4,'2026-07-06 17:06:39.570225+00'),
('6c53a66b-e3cc-45f1-8934-0b69ab473376','e250df79-884c-4195-b90a-b21028e79ae8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/e250df79-884c-4195-b90a-b21028e79ae8/photo-0-1783363242382-i9pmw0.jpg',0,'2026-07-06 18:40:42.959277+00'),
('1a640851-da40-414d-a3bd-fe4d91641506','e250df79-884c-4195-b90a-b21028e79ae8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/e250df79-884c-4195-b90a-b21028e79ae8/photo-1-1783363242889-1kawla.heic',1,'2026-07-06 18:40:44.559458+00'),
('058876fd-afe7-4ddc-842a-f9a9876ebd0b','e250df79-884c-4195-b90a-b21028e79ae8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/e250df79-884c-4195-b90a-b21028e79ae8/photo-3-1783363250188-ngek1t.heic',2,'2026-07-06 18:40:51.660966+00'),
('787c1d31-a26c-4047-8d83-18282816fbb4','e250df79-884c-4195-b90a-b21028e79ae8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/e250df79-884c-4195-b90a-b21028e79ae8/photo-4-1783363251587-b8w99k.heic',3,'2026-07-06 18:40:53.233653+00'),
('7a89329a-0fef-4be3-862c-46e8e0e6cc12','e250df79-884c-4195-b90a-b21028e79ae8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/e250df79-884c-4195-b90a-b21028e79ae8/photo-5-1783363253159-xlvtc3.heic',4,'2026-07-06 18:40:54.56892+00'),
('da2af0e8-9657-40bb-b4e3-ce8caa311efa','e250df79-884c-4195-b90a-b21028e79ae8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/e250df79-884c-4195-b90a-b21028e79ae8/photo-6-1783363254520-vjvrfj.png',5,'2026-07-06 18:40:55.872765+00'),
('ef20f52a-9ffe-4ec6-96b7-68b0c102fd6e','86942594-a783-49e7-bc1e-3d12be0ff00e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/86942594-a783-49e7-bc1e-3d12be0ff00e/photo-0-1783363575455-6elwxp.png',0,'2026-07-06 18:46:17.11541+00'),
('b21e0586-f481-4495-a895-437c58f5538a','86942594-a783-49e7-bc1e-3d12be0ff00e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/86942594-a783-49e7-bc1e-3d12be0ff00e/photo-1-1783363577044-4gpi1g.jpg',1,'2026-07-06 18:46:18.547307+00'),
('9b34ad5c-f047-4f99-b0a4-3dbd3bb2e770','86942594-a783-49e7-bc1e-3d12be0ff00e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/86942594-a783-49e7-bc1e-3d12be0ff00e/photo-2-1783363578476-6qwn4g.jpg',2,'2026-07-06 18:46:19.870991+00'),
('3222861b-587f-498d-b8e4-7c84d3b6fd1e','86942594-a783-49e7-bc1e-3d12be0ff00e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/86942594-a783-49e7-bc1e-3d12be0ff00e/photo-3-1783363579796-imjj2z.jpg',3,'2026-07-06 18:46:21.176366+00'),
('00988e0b-bd7b-47b1-abe5-14c1ff680ed2','86942594-a783-49e7-bc1e-3d12be0ff00e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/86942594-a783-49e7-bc1e-3d12be0ff00e/photo-4-1783363581108-j9n4ei.png',4,'2026-07-06 18:46:22.462254+00'),
('9e4a802c-3dfa-4e56-bf85-1b0e44c193c7','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-1-1783364148878-wnwn5j.png',0,'2026-07-06 18:55:50.482403+00'),
('59e1067d-ddb4-48a4-b952-390a4fee1aaa','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-2-1783364150413-6qjqkx.jpg',1,'2026-07-06 18:55:51.682387+00'),
('1bc84a3c-60df-45ef-8716-c24b611ccc20','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-3-1783364151609-2mxj8d.jpg',2,'2026-07-06 18:55:53.354877+00'),
('614ba363-a395-4239-916d-060776662ac5','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-4-1783364153282-t1johd.jpg',3,'2026-07-06 18:55:54.657174+00'),
('db528e97-cf3a-4b4f-aebd-dbc1a5c133cd','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-5-1783364154587-ykltfu.jpg',4,'2026-07-06 18:55:56.80215+00'),
('231ae4c6-df53-48ef-9c3b-673f07215220','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-6-1783364156724-9bbde2.jpg',5,'2026-07-06 18:55:58.415849+00'),
('ee343e87-b4b0-4442-ad7b-02e63fe1550e','0760222b-6b67-4a32-8de8-8f6113deb73b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0760222b-6b67-4a32-8de8-8f6113deb73b/photo-7-1783364158340-sbq0o2.png',6,'2026-07-06 18:55:59.656984+00'),
('a5347351-0ad8-400e-a681-d6a227b811cd','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-0-1783364547745-l9sto9.png',0,'2026-07-06 19:02:29.854623+00'),
('4beef98a-7924-43e0-98d4-88ca7d2eb4de','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-1-1783364549781-dc1f2t.png',1,'2026-07-06 19:02:31.593496+00'),
('9ac73e57-ef33-43c7-839c-a257f47e5359','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-2-1783364551516-dqmfuk.jpg',2,'2026-07-06 19:02:32.985682+00'),
('7a7511f2-385a-4fd3-83af-f1a0fd90641e','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-3-1783364552914-7qjbsn.jpg',3,'2026-07-06 19:02:34.261966+00'),
('e85034d8-d22c-4b85-88e5-12336a5e4208','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-4-1783364554190-371pet.jpg',4,'2026-07-06 19:02:35.359557+00'),
('07eb51fa-bff8-4022-93f0-bc4e205df71e','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-5-1783364555299-wczca2.jpg',5,'2026-07-06 19:02:37.205731+00'),
('c536ee98-cbb5-47f3-8204-a4e7bdd862fa','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-6-1783364557128-8dwygk.jpg',6,'2026-07-06 19:02:38.338487+00'),
('0f8e9d0c-c0bc-4aa7-b534-2f73e052f35a','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-7-1783364558262-0k0stv.jpg',7,'2026-07-06 19:02:39.592421+00'),
('8b7235d6-2da2-4a9e-9613-c94466a9c19d','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-8-1783364559522-s20h9k.jpg',8,'2026-07-06 19:02:40.89725+00'),
('ceb62e51-1130-4034-8cf5-f68eea3701b7','9d08c378-fb3c-4118-a0bb-76af13ffa59e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9d08c378-fb3c-4118-a0bb-76af13ffa59e/photo-9-1783364560825-pdufvg.png',9,'2026-07-06 19:02:42.306045+00'),
('da05878a-f9e5-443b-8c4e-b4c254e50948','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-0-1783365255661-b1mxl9.png',0,'2026-07-06 19:14:17.539292+00'),
('52757197-9020-43fa-8e4a-5d6369bf0d15','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-1-1783365257551-wfhnw9.png',1,'2026-07-06 19:14:19.67231+00'),
('82afc34c-bb2b-4e03-bb97-d118bc22ef22','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-2-1783365259670-uzndc1.png',2,'2026-07-06 19:14:21.539825+00'),
('7844bd85-5465-4791-8e5c-c6edd6c11ec0','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-3-1783365261531-65yp3v.png',3,'2026-07-06 19:14:23.370424+00'),
('67f308b0-31da-48fe-a307-d4d077254298','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-4-1783365263369-x76trn.jpg',4,'2026-07-06 19:14:25.369557+00'),
('7b339cf5-0d8e-4a82-896b-0860acfb87f4','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-5-1783365265371-7xuk6v.jpg',5,'2026-07-06 19:14:27.967738+00'),
('6bd4d1e4-cfbb-4d3d-8f3b-e33e43040e4f','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-6-1783365267982-oekmky.png',6,'2026-07-06 19:14:29.615713+00'),
('89197ef1-1d39-48ef-932b-76bb34059593','ae0974b9-a4ee-4f95-b06c-890cb1f596c6','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/ae0974b9-a4ee-4f95-b06c-890cb1f596c6/photo-7-1783365269612-dupiqm.png',7,'2026-07-06 19:14:30.993342+00'),
('e20bf981-8c85-4d06-b43d-423d06fb9c6a','fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/fdd58ebc-6269-4d8c-a9aa-a28d715d9db4/photo-0-1783365823196-axwbx4.png',0,'2026-07-06 19:23:43.910655+00'),
('0997f1d7-4ad0-458a-be47-7f78161f135c','fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/fdd58ebc-6269-4d8c-a9aa-a28d715d9db4/photo-1-1783365823918-uem56x.png',1,'2026-07-06 19:23:49.111285+00'),
('dc0a23d7-30ca-4300-840f-0c313fa8c55a','fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/fdd58ebc-6269-4d8c-a9aa-a28d715d9db4/photo-2-1783365829168-isrh7e.png',2,'2026-07-06 19:23:54.500889+00'),
('0318786b-1815-409d-bf65-450e77500fb4','fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/fdd58ebc-6269-4d8c-a9aa-a28d715d9db4/photo-3-1783365834510-0usamv.png',3,'2026-07-06 19:23:59.623998+00'),
('1f94bb8c-eabf-4c7c-b956-7ee005d4b968','fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/fdd58ebc-6269-4d8c-a9aa-a28d715d9db4/photo-4-1783365839631-bt6an1.png',4,'2026-07-06 19:24:00.363112+00'),
('0dd4fb19-a8a9-4844-a739-95f08b95a709','fdd58ebc-6269-4d8c-a9aa-a28d715d9db4','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/fdd58ebc-6269-4d8c-a9aa-a28d715d9db4/photo-5-1783365840373-flro6q.png',5,'2026-07-06 19:24:02.114648+00'),
('9be83faf-46a4-4982-91f7-387c857ff1b3','3a53990e-6fe0-44ed-bc86-724b1c179cbd','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3a53990e-6fe0-44ed-bc86-724b1c179cbd/photo-0-1783453022476-01eeni.webp',0,'2026-07-07 19:37:03.001715+00'),
('3a88f3f6-0c42-43cb-8d56-2b595899ff88','3a53990e-6fe0-44ed-bc86-724b1c179cbd','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3a53990e-6fe0-44ed-bc86-724b1c179cbd/photo-1-1783453022969-c79xfg.webp',1,'2026-07-07 19:37:03.739383+00'),
('556c5120-111a-4a3c-ac04-0d0c10709924','3a53990e-6fe0-44ed-bc86-724b1c179cbd','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3a53990e-6fe0-44ed-bc86-724b1c179cbd/photo-2-1783453023684-28b855.webp',2,'2026-07-07 19:37:04.330878+00'),
('eec27129-a5a8-49c7-b792-87a51a7f5616','045e7ad5-ceb3-4097-8da7-8e68dc6fccf1','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/045e7ad5-ceb3-4097-8da7-8e68dc6fccf1/photo-0-1783453289307-337e3k.webp',0,'2026-07-07 19:41:29.775028+00'),
('f5dbe708-5b6e-4c24-9a89-14d20446f7ee','045e7ad5-ceb3-4097-8da7-8e68dc6fccf1','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/045e7ad5-ceb3-4097-8da7-8e68dc6fccf1/photo-1-1783453289734-vp06uy.webp',1,'2026-07-07 19:41:30.254329+00'),
('ef3ca90e-5189-42fd-b06b-86ddab9625a4','045e7ad5-ceb3-4097-8da7-8e68dc6fccf1','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/045e7ad5-ceb3-4097-8da7-8e68dc6fccf1/photo-2-1783453290220-rxtzqw.webp',2,'2026-07-07 19:41:30.725174+00'),
('2d45acb1-dec8-4776-a28d-1d4353884756','045e7ad5-ceb3-4097-8da7-8e68dc6fccf1','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/045e7ad5-ceb3-4097-8da7-8e68dc6fccf1/photo-3-1783453290682-s1703t.webp',3,'2026-07-07 19:41:31.130792+00'),
('92a6b820-2257-46c1-8b4b-5aa7965d0b29','c301f604-11a9-48ff-86ff-a79233f2dd61','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/c301f604-11a9-48ff-86ff-a79233f2dd61/photo-0-1783452770485-qtvsv7.webp',0,'2026-07-07 19:32:51.195541+00'),
('af48f490-1e97-40e8-a1ba-53c7425bdd30','c301f604-11a9-48ff-86ff-a79233f2dd61','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/c301f604-11a9-48ff-86ff-a79233f2dd61/photo-1-1783452771156-pbt1za.webp',1,'2026-07-07 19:32:51.847036+00'),
('488314e4-43fc-43ed-a003-16c34a7f4ddd','c301f604-11a9-48ff-86ff-a79233f2dd61','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/c301f604-11a9-48ff-86ff-a79233f2dd61/photo-2-1783452771802-k9arjp.webp',2,'2026-07-07 19:32:52.30313+00'),
('7640cac6-5b22-4081-89c0-02d496c246b2','c301f604-11a9-48ff-86ff-a79233f2dd61','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/c301f604-11a9-48ff-86ff-a79233f2dd61/photo-3-1783452772259-wiz071.webp',3,'2026-07-07 19:32:52.658718+00'),
('268984bd-eba4-41cd-ab9f-0f017dc834f5','0d5e5eb8-e1e7-4f3d-9755-529b1990418b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0d5e5eb8-e1e7-4f3d-9755-529b1990418b/photo-0-1783453551829-9yifes.webp',0,'2026-07-07 19:45:52.29505+00'),
('ee2c5532-933f-43cb-b60b-aa74ebf0e2e7','0d5e5eb8-e1e7-4f3d-9755-529b1990418b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0d5e5eb8-e1e7-4f3d-9755-529b1990418b/photo-1-1783453552245-5nh5h4.webp',1,'2026-07-07 19:45:52.897877+00'),
('80668b55-b191-43a0-8e10-53600da7e973','0d5e5eb8-e1e7-4f3d-9755-529b1990418b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0d5e5eb8-e1e7-4f3d-9755-529b1990418b/photo-2-1783453552844-hfxafn.webp',2,'2026-07-07 19:45:53.475572+00'),
('28509897-ef13-4522-9309-bdfde29d4c0d','3d52377a-107f-48cb-8bf2-5aaeae59bf58','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3d52377a-107f-48cb-8bf2-5aaeae59bf58/photo-0-1783511033970-9hu27s.webp',0,'2026-07-08 11:43:54.679186+00'),
('84ae1aad-9032-4a21-9ad6-a5df91fdac51','3d52377a-107f-48cb-8bf2-5aaeae59bf58','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3d52377a-107f-48cb-8bf2-5aaeae59bf58/photo-1-1783511034577-r8qthl.webp',1,'2026-07-08 11:43:55.225164+00'),
('8628e7bf-e170-4001-ae80-cd1771a6f7ab','3d52377a-107f-48cb-8bf2-5aaeae59bf58','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3d52377a-107f-48cb-8bf2-5aaeae59bf58/photo-2-1783511035117-wff7ep.webp',2,'2026-07-08 11:43:55.78247+00'),
('9f774c39-739e-47de-996d-54d62a4d241d','29b525b2-e722-4ef3-9425-70f2d1b0050f','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/29b525b2-e722-4ef3-9425-70f2d1b0050f/photo-0-1783511277227-8dnkln.webp',0,'2026-07-08 11:47:57.927772+00'),
('95804dae-7149-4dbe-927e-21f507492eea','29b525b2-e722-4ef3-9425-70f2d1b0050f','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/29b525b2-e722-4ef3-9425-70f2d1b0050f/photo-1-1783511277823-dk6mxu.webp',1,'2026-07-08 11:47:58.411017+00'),
('7d9c327f-2b6a-4ca7-ae1c-eb8e2f87cf04','29b525b2-e722-4ef3-9425-70f2d1b0050f','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/29b525b2-e722-4ef3-9425-70f2d1b0050f/photo-2-1783511278302-rrwxrk.webp',2,'2026-07-08 11:47:58.896436+00'),
('dcb5541c-6154-4972-9e13-de2a03dc5980','b6f94ff7-43c3-46d7-a787-1d629f63dbca','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/b6f94ff7-43c3-46d7-a787-1d629f63dbca/photo-0-1783511402751-loj1vt.webp',0,'2026-07-08 11:50:03.552701+00'),
('c7d333e1-2355-47da-9a99-8750f366ee1a','b6f94ff7-43c3-46d7-a787-1d629f63dbca','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/b6f94ff7-43c3-46d7-a787-1d629f63dbca/photo-1-1783511403456-s8rfb0.webp',1,'2026-07-08 11:50:04.269256+00'),
('639ac452-cf7a-4c10-abdd-50e5b7390ad9','b6f94ff7-43c3-46d7-a787-1d629f63dbca','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/b6f94ff7-43c3-46d7-a787-1d629f63dbca/photo-2-1783511404164-s8alvw.webp',2,'2026-07-08 11:50:04.811595+00'),
('eb4cb964-1cd5-4de8-9474-3597cb2d23af','b3ee840e-d212-4b64-b8c3-792eb35d94e5','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/b3ee840e-d212-4b64-b8c3-792eb35d94e5/photo-0-1783511506414-e05byi.webp',0,'2026-07-08 11:51:47.146468+00'),
('7923631f-856f-40f5-8823-246e74025e18','b3ee840e-d212-4b64-b8c3-792eb35d94e5','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/b3ee840e-d212-4b64-b8c3-792eb35d94e5/photo-1-1783511507029-dnri3t.webp',1,'2026-07-08 11:51:47.61675+00'),
('72efb5e1-2e85-4261-8f45-8dc88e0c1f67','b3ee840e-d212-4b64-b8c3-792eb35d94e5','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/b3ee840e-d212-4b64-b8c3-792eb35d94e5/photo-2-1783511507506-esuy8f.webp',2,'2026-07-08 11:51:48.324692+00'),
('0a58321b-0b9d-4331-a56a-72bd1ad67ae4','3649130a-e6bf-4fa1-93d4-998c09aadb8b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3649130a-e6bf-4fa1-93d4-998c09aadb8b/photo-0-1783511659779-fuhv5w.webp',0,'2026-07-08 11:54:20.491103+00'),
('8e46ee63-85b8-4211-9614-b6cff1c8bac8','3649130a-e6bf-4fa1-93d4-998c09aadb8b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3649130a-e6bf-4fa1-93d4-998c09aadb8b/photo-1-1783511660381-pl9upo.webp',1,'2026-07-08 11:54:21.04603+00'),
('7b2390ca-66f3-4185-962d-e8565520ec92','3649130a-e6bf-4fa1-93d4-998c09aadb8b','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3649130a-e6bf-4fa1-93d4-998c09aadb8b/photo-2-1783511660935-nmztbs.webp',2,'2026-07-08 11:54:21.600018+00'),
('eb786e61-f62a-485b-9dec-fe82856e2798','dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f/photo-0-1783511772004-708fwx.webp',0,'2026-07-08 11:56:12.801442+00'),
('927bd80c-0a1f-4b5b-bed5-6040336b3e44','dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f/photo-1-1783511772680-rpgow5.webp',1,'2026-07-08 11:56:13.368968+00'),
('23162fa3-0c28-45c7-a76e-6941d1918873','dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/dae2a864-6e9b-4d63-a1d1-fa65fb5aa30f/photo-2-1783511773243-pse82w.webp',2,'2026-07-08 11:56:14.098202+00'),
('06c4e05e-3f55-424a-8b82-b30200275b08','614d4526-3eda-495a-866b-774878efcefd','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/614d4526-3eda-495a-866b-774878efcefd/photo-0-1783511942112-c0eiuj.webp',0,'2026-07-08 11:59:03.33596+00'),
('41fc1b0d-195f-4bd6-8879-83342a41d756','614d4526-3eda-495a-866b-774878efcefd','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/614d4526-3eda-495a-866b-774878efcefd/photo-1-1783511943213-0h429s.webp',1,'2026-07-08 11:59:03.922166+00'),
('42a78448-4597-463e-a2d2-5fa10a5bc139','614d4526-3eda-495a-866b-774878efcefd','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/614d4526-3eda-495a-866b-774878efcefd/photo-2-1783511943797-17yy2x.webp',2,'2026-07-08 11:59:04.267587+00'),
('05b88fab-28a8-4f2c-805f-84122d52a42b','23065b9f-edbc-4a0e-8ac9-187e4ace87b9','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/23065b9f-edbc-4a0e-8ac9-187e4ace87b9/photo-0-1783512428935-fu1z1m.webp',0,'2026-07-08 12:07:09.567587+00'),
('ec501e0f-726a-4ddb-b27e-2413a2ae815a','23065b9f-edbc-4a0e-8ac9-187e4ace87b9','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/23065b9f-edbc-4a0e-8ac9-187e4ace87b9/photo-1-1783512429433-rzkymx.webp',1,'2026-07-08 12:07:10.129058+00'),
('40528810-dbaf-490b-8b40-53d94425584b','23065b9f-edbc-4a0e-8ac9-187e4ace87b9','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/23065b9f-edbc-4a0e-8ac9-187e4ace87b9/photo-2-1783512429993-g9ckuj.webp',2,'2026-07-08 12:07:10.75131+00'),
('a7eda07f-c812-47d2-8abb-6e44b60c53b8','23065b9f-edbc-4a0e-8ac9-187e4ace87b9','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/23065b9f-edbc-4a0e-8ac9-187e4ace87b9/photo-3-1783512430620-7xsdgb.webp',3,'2026-07-08 12:07:11.322714+00'),
('aaf011f0-377e-40d5-90a9-dba22ccf51a6','9335f3e0-857a-4303-bce4-b9ff7fb2b41e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9335f3e0-857a-4303-bce4-b9ff7fb2b41e/photo-0-1783513214807-1sra9c.webp',0,'2026-07-08 12:20:15.392645+00'),
('a109ea0b-b24a-4cb1-8d64-eaa183db3da8','9335f3e0-857a-4303-bce4-b9ff7fb2b41e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9335f3e0-857a-4303-bce4-b9ff7fb2b41e/photo-1-1783513215363-t6nhyr.webp',1,'2026-07-08 12:20:15.912077+00'),
('6a5d9340-e408-4e8b-9cbd-55c8406ecf39','9335f3e0-857a-4303-bce4-b9ff7fb2b41e','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/9335f3e0-857a-4303-bce4-b9ff7fb2b41e/photo-2-1783513215870-ckar1v.webp',2,'2026-07-08 12:20:16.392964+00'),
('0f95193d-5a2b-41ac-b4bf-e8bcad508aa7','f2df2f07-22a3-41b0-907a-24004fccc593','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/f2df2f07-22a3-41b0-907a-24004fccc593/photo-0-1783513379763-smem0d.webp',0,'2026-07-08 12:23:00.358912+00'),
('eb9e2f13-e184-4c12-806c-ae7343ee0521','f2df2f07-22a3-41b0-907a-24004fccc593','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/f2df2f07-22a3-41b0-907a-24004fccc593/photo-1-1783513380311-11e4gc.webp',1,'2026-07-08 12:23:00.864901+00'),
('abe38ae5-4211-40c9-84ac-620f7db76508','f2df2f07-22a3-41b0-907a-24004fccc593','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/f2df2f07-22a3-41b0-907a-24004fccc593/photo-2-1783513380821-t4exvb.webp',2,'2026-07-08 12:23:01.339972+00'),
('39e15b28-c258-4c13-be12-e8f414802533','facb30a7-7f65-4902-9cef-1d01fc814adb','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/facb30a7-7f65-4902-9cef-1d01fc814adb/photo-0-1783513587248-3wulx2.png',0,'2026-07-08 12:26:29.673599+00'),
('423c3eec-2340-4f7d-af92-5d69ce4307d0','facb30a7-7f65-4902-9cef-1d01fc814adb','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/facb30a7-7f65-4902-9cef-1d01fc814adb/photo-1-1783513589622-b9irs3.webp',1,'2026-07-08 12:26:30.226165+00'),
('25ed4617-3a55-4827-91f4-6aa4933547e6','facb30a7-7f65-4902-9cef-1d01fc814adb','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/facb30a7-7f65-4902-9cef-1d01fc814adb/photo-2-1783513590178-4a8rbs.webp',2,'2026-07-08 12:26:30.703553+00'),
('3c32973b-5fc2-432c-8ce9-07bbe5ad2679','66a30509-731b-4a8e-a9b8-6a6c08b71512','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/66a30509-731b-4a8e-a9b8-6a6c08b71512/photo-0-1783623775597-0hd466.webp',0,'2026-07-09 19:02:56.094979+00'),
('135c219e-2d15-4d10-a228-3ed06d7d66f7','66a30509-731b-4a8e-a9b8-6a6c08b71512','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/66a30509-731b-4a8e-a9b8-6a6c08b71512/photo-1-1783623776042-spsqs0.webp',1,'2026-07-09 19:02:56.410034+00'),
('f0745f97-305b-401a-a641-69c11f3cfa55','66a30509-731b-4a8e-a9b8-6a6c08b71512','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/66a30509-731b-4a8e-a9b8-6a6c08b71512/photo-2-1783623776360-ba70ul.webp',2,'2026-07-09 19:02:56.744361+00'),
('8aa39119-45f8-447f-87fa-9f4069268659','66a30509-731b-4a8e-a9b8-6a6c08b71512','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/66a30509-731b-4a8e-a9b8-6a6c08b71512/photo-3-1783623776693-xyyp24.webp',3,'2026-07-09 19:02:57.04909+00'),
('b05cf5a7-0504-4dfc-af83-cd4faf3dfab8','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-0-1783623432370-7ll1fj.webp',0,'2026-07-09 18:57:12.800047+00'),
('f56dca91-67fe-49bf-b8d7-2a2458783b79','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-1-1783623432776-cbcc86.webp',1,'2026-07-09 18:57:13.165743+00'),
('feb8af47-3a22-4df4-93f1-ae242be5bfde','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-2-1783623433138-s3qt1x.webp',2,'2026-07-09 18:57:13.703991+00'),
('d3929f8b-613f-4736-bcf3-ab175704b567','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-3-1783623433669-ova568.webp',3,'2026-07-09 18:57:14.217445+00'),
('adf77758-aceb-449b-8fd2-39e844cf84a7','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-4-1783623434183-npu5v4.webp',4,'2026-07-09 18:57:14.705611+00'),
('ec4ddca5-b258-44a0-823f-956d421d5e6a','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-5-1783623434670-zslu39.webp',5,'2026-07-09 18:57:15.097566+00'),
('25c0edda-7a21-42fe-a893-28ac6ae58d44','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-6-1783623435071-a31m76.webp',6,'2026-07-09 18:57:15.521919+00'),
('516364fa-8ae7-4bd0-abf1-36f01e79bece','71bb828c-1278-47ea-a94c-72c7837b5d97','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/71bb828c-1278-47ea-a94c-72c7837b5d97/photo-7-1783623435486-wk4nu7.webp',7,'2026-07-09 18:57:15.974603+00'),
('a5bcfdca-9c4a-41ac-9735-c579eae7a891','0a272772-34c4-40b6-a436-6e35dc93c7b8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0a272772-34c4-40b6-a436-6e35dc93c7b8/photo-0-1783623582480-qdyp8h.webp',0,'2026-07-09 18:59:42.942093+00'),
('21450030-1e43-4447-9937-8d16cd6c4f0e','0a272772-34c4-40b6-a436-6e35dc93c7b8','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/0a272772-34c4-40b6-a436-6e35dc93c7b8/photo-1-1783623582897-9uepcs.webp',1,'2026-07-09 18:59:43.360146+00'),
('5226a5be-fe07-4526-9e05-97898b53a27e','3c09c3c7-060e-4604-96cb-679cf20161ec','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3c09c3c7-060e-4604-96cb-679cf20161ec/photo-0-1784838736357-rai1qz.webp',0,'2026-07-23 20:32:17.104834+00'),
('3e7b18b5-f748-4150-b971-d1b48d2132a7','3c09c3c7-060e-4604-96cb-679cf20161ec','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3c09c3c7-060e-4604-96cb-679cf20161ec/photo-3-1784838738012-djdutu.webp',3,'2026-07-23 20:32:18.515183+00'),
('2339ab63-ab3a-469b-9c17-327755a666b0','3c09c3c7-060e-4604-96cb-679cf20161ec','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3c09c3c7-060e-4604-96cb-679cf20161ec/photo-1-1784838737061-5136gp.webp',1,'2026-07-23 20:32:17.660621+00'),
('fdcba49c-7461-4798-af72-c1744e3a406e','3c09c3c7-060e-4604-96cb-679cf20161ec','https://uzkrxkoussjnlyyykkul.supabase.co/storage/v1/object/public/listings/069f6607-b95e-4a32-9d2f-351124be9a56/3c09c3c7-060e-4604-96cb-679cf20161ec/photo-2-1784838737609-of9wkt.webp',2,'2026-07-23 20:32:18.047629+00');

COMMIT;

-- ─────────────────────────────────────────────
-- Vérifications post-exécution
-- ─────────────────────────────────────────────
-- SELECT id, email FROM auth.users WHERE id = '069f6607-b95e-4a32-9d2f-351124be9a56';
-- SELECT id FROM public.profiles WHERE id = '069f6607-b95e-4a32-9d2f-351124be9a56';
-- SELECT COUNT(*) FROM public.listings WHERE seller_id = '069f6607-b95e-4a32-9d2f-351124be9a56';
-- SELECT COUNT(*) FROM public.listing_photos WHERE listing_id IN (SELECT id FROM public.listings WHERE seller_id = '069f6607-b95e-4a32-9d2f-351124be9a56');
