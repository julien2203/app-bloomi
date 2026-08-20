-- Restore David Henninger — PROD only
-- user: 069f6607-b95e-4a32-9d2f-351124be9a56 / davidhenninger1@gmail.com
-- Source: sauvegarde locale (auth.users export)
-- ATTENTION : encrypted_password laissé vide → l'utilisateur devra faire "Mot de passe oublié"

BEGIN;

-- ─────────────────────────────────────────────
-- 1. Recréer l'entrée dans auth.users
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
  '2026-07-06 16:43:05.949806+00',   -- confirmed_at
  NULL,
  '',
  '2026-07-06 16:42:39.474295+00',   -- confirmation_sent_at
  '',
  NULL,
  '',
  '',
  NULL,
  '2026-07-06 16:52:43.207234+00',   -- last_sign_in_at
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"sub":"069f6607-b95e-4a32-9d2f-351124be9a56","email":"davidhenninger1@gmail.com","username":"okamarkt","full_name":"David Henninger","user_type":"selling","email_verified":true,"phone_verified":false,"marketing_optin":false}'::jsonb,
  NULL,
  '2026-07-06 16:42:39.461357+00',   -- created_at
  '2026-07-25 09:24:29.472786+00',   -- updated_at
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
-- 2. Recréer l'identité email dans auth.identities
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
  '2026-07-06 16:42:39.461357+00',
  '2026-07-06 16:42:39.461357+00',
  '2026-07-06 16:42:39.461357+00',
  gen_random_uuid()  -- nouvel UUID pour l'identité
);

-- ─────────────────────────────────────────────
-- 3. Vérifier si le profil public existe déjà
--    (peut exister si supprimé seulement de auth.users)
-- ─────────────────────────────────────────────
-- Si la ligne ci-dessous retourne 0, exécute le INSERT profiles plus bas.
-- SELECT COUNT(*) FROM public.profiles WHERE id = '069f6607-b95e-4a32-9d2f-351124be9a56';

-- INSERT INTO public.profiles (id, created_at, updated_at, language)
-- VALUES (
--   '069f6607-b95e-4a32-9d2f-351124be9a56',
--   '2026-07-06 16:42:39.461357+00',
--   '2026-07-25 09:24:29.472786+00',
--   'fr'
-- )
-- ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ─────────────────────────────────────────────
-- 4. Après exécution : envoyer un reset password
-- ─────────────────────────────────────────────
-- Dans le dashboard Supabase → Authentication → Users
-- Chercher davidhenninger1@gmail.com → "Send password reset"
-- OU via l'API admin :
--   supabase.auth.admin.generateLink({ type: 'recovery', email: 'davidhenninger1@gmail.com' })
