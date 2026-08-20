-- Restore David Henninger — PROD only
-- Supprimer le compte Google (7e782c50-5314-4918-b710-db51f604d1fc)
-- Réinsérer l'ancien compte email (069f6607-b95e-4a32-9d2f-351124be9a56)
-- ATTENTION : exécuter en une seule transaction

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Supprimer le profil public du compte Google
--    (probablement vide, mais à nettoyer)
-- ─────────────────────────────────────────────
DELETE FROM public.profiles
WHERE id = '7e782c50-5314-4918-b710-db51f604d1fc';

-- ─────────────────────────────────────────────
-- 2. Supprimer les identités du compte Google
-- ─────────────────────────────────────────────
DELETE FROM auth.identities
WHERE user_id = '7e782c50-5314-4918-b710-db51f604d1fc';

-- ─────────────────────────────────────────────
-- 3. Supprimer le compte Google de auth.users
-- ─────────────────────────────────────────────
DELETE FROM auth.users
WHERE id = '7e782c50-5314-4918-b710-db51f604d1fc';

-- ─────────────────────────────────────────────
-- 4. Réinsérer l'ancien compte email
-- ─────────────────────────────────────────────
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at,
  is_anonymous
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  'authenticated',
  'authenticated',
  'davidhenninger1@gmail.com',
  '',   -- mot de passe vide → reset password requis
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
-- 5. Réinsérer l'identité email
-- ─────────────────────────────────────────────
INSERT INTO auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at,
  id
) VALUES (
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  '069f6607-b95e-4a32-9d2f-351124be9a56',
  '{"sub":"069f6607-b95e-4a32-9d2f-351124be9a56","email":"davidhenninger1@gmail.com","username":"okamarkt","full_name":"David Henninger","user_type":"selling","email_verified":true,"phone_verified":false,"marketing_optin":false}'::jsonb,
  'email',
  '2026-07-06 16:52:43.207234+00',
  '2026-07-06 16:42:39.461357+00',
  '2026-07-06 16:42:39.461357+00',
  gen_random_uuid()
);

COMMIT;

-- ─────────────────────────────────────────────
-- 6. Vérifications post-exécution
-- ─────────────────────────────────────────────
-- SELECT id, email, created_at, raw_app_meta_data FROM auth.users WHERE email = 'davidhenninger1@gmail.com';
-- SELECT * FROM auth.identities WHERE user_id = '069f6607-b95e-4a32-9d2f-351124be9a56';
-- SELECT id FROM public.profiles WHERE id = '069f6607-b95e-4a32-9d2f-351124be9a56';

-- ─────────────────────────────────────────────
-- 7. Envoyer un reset password depuis le dashboard
--    Authentication → Users → davidhenninger1@gmail.com → Send password reset
-- ─────────────────────────────────────────────
