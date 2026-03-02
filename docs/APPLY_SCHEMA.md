# Guide d'application du schéma Supabase

## Prérequis

- Accès au dashboard Supabase de votre projet
- Projet Supabase configuré avec l'authentification activée

## Étapes d'application

### 0. Migration de l'ancienne table profiles (si nécessaire)

Si vous avez déjà créé la table `profiles` avec l'ancien schéma (`supabase_profiles.sql`), 
exécutez d'abord la migration:

1. Dans **SQL Editor**, ouvrir `docs/supabase_migrate_profiles.sql`
2. Copier et exécuter le contenu
3. Cela ajoutera la colonne `updated_at` si elle n'existe pas

### 1. Appliquer le schéma de base de données

1. Ouvrir le **Supabase Dashboard**
2. Aller dans **SQL Editor** (menu de gauche)
3. Cliquer sur **New Query**
4. Ouvrir le fichier `docs/supabase_schema.sql`
5. Copier tout le contenu du fichier
6. Coller dans l'éditeur SQL
7. Cliquer sur **Run** (ou `Ctrl+Enter`)
8. Vérifier qu'il n'y a pas d'erreurs dans les résultats

**Résultat attendu**: Toutes les tables, types enum, indexes et triggers sont créés.

### 2. Appliquer les politiques RLS

1. Toujours dans **SQL Editor**
2. Créer une nouvelle requête
3. Ouvrir le fichier `docs/supabase_rls.sql`
4. Copier tout le contenu
5. Coller dans l'éditeur SQL
6. Cliquer sur **Run**
7. Vérifier qu'il n'y a pas d'erreurs

**Résultat attendu**: Toutes les politiques RLS sont créées et activées.

### 3. Vérification

#### Vérifier les tables créées:
1. Aller dans **Table Editor** (menu de gauche)
2. Vérifier que les tables suivantes existent:
   - `profiles`
   - `listings`
   - `listing_photos`
   - `threads`
   - `messages`
   - `orders`

#### Vérifier les politiques RLS:
1. Aller dans **Authentication** > **Policies** (ou **Table Editor** > sélectionner une table > onglet **Policies**)
2. Vérifier que chaque table a des politiques RLS actives

#### Vérifier les types enum:
1. Dans **SQL Editor**, exécuter:
```sql
SELECT typname FROM pg_type WHERE typtype = 'e';
```
2. Vérifier que les types suivants existent:
   - `listing_status`
   - `order_status`
   - `delivery_mode`

## Tests rapides

### Test 1: Créer un profile (depuis l'app)
L'app devrait créer automatiquement un profile lors de la première connexion via `ensureProfileExists()`.

### Test 2: Vérifier les RLS
Dans **SQL Editor**, tester une requête en tant qu'utilisateur anonyme:
```sql
-- Devrait échouer (pas de session)
SELECT * FROM profiles;
```

Puis tester en tant qu'utilisateur connecté (depuis l'app):
```sql
-- Devrait fonctionner (retourne uniquement le profile de l'utilisateur connecté)
SELECT * FROM profiles;
```

## Dépannage

### Erreur: "relation already exists"
Si une table existe déjà, vous pouvez:
1. La supprimer manuellement: `DROP TABLE IF EXISTS table_name CASCADE;`
2. Ou modifier le script SQL pour utiliser `CREATE TABLE IF NOT EXISTS`

### Erreur: "type already exists"
Si un type enum existe déjà:
```sql
DROP TYPE IF EXISTS listing_status CASCADE;
-- Puis réexécuter le script
```

### Erreur: "policy already exists"
Les scripts utilisent `DROP POLICY IF EXISTS`, donc normalement pas de problème.
Si erreur persistante, supprimer manuellement:
```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

## Notes importantes

- **Ne pas supprimer** la table `auth.users` (gérée par Supabase)
- Les **profiles** sont créés depuis l'app, pas via trigger (limitation Supabase)
- Les **RLS sont strictes**: si aucune policy ne correspond, l'accès est refusé
- Tester les permissions depuis l'app après application du schéma

## Prochaines étapes

Une fois le schéma appliqué:
1. Tester la création de listings depuis l'app
2. Tester les conversations (threads/messages)
3. Vérifier que les RLS fonctionnent correctement
4. Commencer à implémenter l'UI avec les fonctions de `lib/api.ts`
