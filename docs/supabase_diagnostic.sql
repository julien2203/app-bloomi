-- ============================================
-- DIAGNOSTIC SQL - BLOOMI APP
-- Requêtes pour vérifier l'état actuel de la base
-- ============================================

-- ============================================
-- 1. TABLES ET COLONNES
-- ============================================

-- Lister toutes les tables dans le schéma public
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Colonnes de la table profiles
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Colonnes de la table listings
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'listings'
ORDER BY ordinal_position;

-- Colonnes de la table listing_photos
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'listing_photos'
ORDER BY ordinal_position;

-- Colonnes de la table threads
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'threads'
ORDER BY ordinal_position;

-- Colonnes de la table messages
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'messages'
ORDER BY ordinal_position;

-- Colonnes de la table orders
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'orders'
ORDER BY ordinal_position;

-- ============================================
-- 2. ENUMS
-- ============================================

-- Lister tous les types enum
SELECT 
  t.typname AS enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS enum_values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('listing_status', 'order_status', 'delivery_mode')
GROUP BY t.typname
ORDER BY t.typname;

-- ============================================
-- 3. INDEXES
-- ============================================

-- Lister tous les indexes sur les tables principales
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'listings', 'listing_photos', 'threads', 'messages', 'orders')
ORDER BY tablename, indexname;

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Lister tous les triggers
SELECT 
  trigger_schema,
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 5. RLS ET POLICIES
-- ============================================

-- Vérifier si RLS est activé sur les tables
SELECT 
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'listings', 'listing_photos', 'threads', 'messages', 'orders')
ORDER BY tablename;

-- Lister toutes les policies RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd AS command,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'listings', 'listing_photos', 'threads', 'messages', 'orders')
ORDER BY tablename, policyname;

-- ============================================
-- 6. FOREIGN KEYS ET ON DELETE
-- ============================================

-- Lister toutes les foreign keys avec leur ON DELETE
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule AS on_delete,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('profiles', 'listings', 'listing_photos', 'threads', 'messages', 'orders')
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 7. CONTRAINTES CHECK
-- ============================================

-- Lister les contraintes CHECK
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
  AND tc.table_name IN ('profiles', 'listings', 'listing_photos', 'threads', 'messages', 'orders')
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 8. CONTRAINTES UNIQUE
-- ============================================

-- Lister les contraintes UNIQUE
SELECT
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('profiles', 'listings', 'listing_photos', 'threads', 'messages', 'orders')
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 9. FUNCTIONS
-- ============================================

-- Lister les fonctions custom
SELECT 
  routine_schema,
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_updated_at_column', 'update_thread_last_message_at')
ORDER BY routine_name;

-- ============================================
-- 10. VIEWS
-- ============================================

-- Lister les views existantes
SELECT 
  table_schema,
  table_name,
  view_definition
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN ('v_feed_listings', 'v_thread_list', 'v_listing_detail')
ORDER BY table_name;

-- ============================================
-- FIN DU DIAGNOSTIC
-- ============================================
