# Décisions techniques - Bloomi App

## Architecture Base de Données (Jalon 1)

### Modèle de données choisi

#### 1. **Profiles**
- **Décision**: Table séparée de `auth.users` pour les données applicatives
- **Raison**: 
  - Séparation des préoccupations (auth vs métier)
  - Flexibilité pour ajouter des champs métier sans toucher à auth.users
  - RLS plus simple à gérer
- **Création**: Via `ensureProfileExists()` dans l'app (pas de trigger auth.users car limitation Supabase)

#### 2. **Listings (Annonces)**
- **Décision**: Table principale avec statuts (draft/published/sold/archived)
- **Raison**:
  - Permet de travailler sur une annonce avant publication
  - Historique des annonces vendues
  - Scalabilité pour futures fonctionnalités (promotions, featured, etc.)
- **Géolocalisation**: Champs `latitude/longitude` prévus mais optionnels pour MVP
- **Indexes**: Optimisés pour recherche par statut, catégorie, date, géolocalisation

#### 3. **Listing_Photos**
- **Décision**: Table séparée avec `order_index` pour l'ordre d'affichage
- **Raison**:
  - Flexibilité pour plusieurs photos par annonce
  - Réordonnancement facile
  - Stockage externe (URL) plutôt que BLOB en DB

#### 4. **Threads (Conversations)**
- **Décision**: Table de conversation avec contrainte unique `(listing_id, buyer_id)`
- **Raison**:
  - Un buyer ne peut avoir qu'une seule conversation par listing
  - Simplifie la logique métier
  - `last_message_at` mis à jour automatiquement via trigger

#### 5. **Messages**
- **Décision**: Table simple avec `read_at` pour le suivi de lecture
- **Raison**:
  - Structure simple et performante
  - `read_at` nullable pour messages non lus
  - Pas de suppression (archivage via soft delete si besoin plus tard)

#### 6. **Orders (Commandes)**
- **Décision**: Table avec statuts et dates de transition
- **Raison**:
  - Suivi complet du cycle de vie d'une commande
  - Dates séparées pour chaque étape (confirmed_at, shipped_at, etc.)
  - Support pour livraison (shipping) et retrait (pickup)

### Row Level Security (RLS)

#### Philosophie: "Strict par défaut"
- Toutes les tables ont RLS activé
- Pas d'accès par défaut si aucune policy ne correspond
- Policies granulaires par opération (SELECT, INSERT, UPDATE, DELETE)

#### Patterns utilisés:
1. **Propriété**: `auth.uid() = owner_id` pour les ressources personnelles
2. **Public read, owner write**: Listings publiés lisibles par tous, modifiables par le vendeur
3. **Participants only**: Threads/messages accessibles uniquement par buyer/seller
4. **Role-based**: Orders accessibles par buyer ET seller

### Indexes

#### Stratégie:
- Index sur toutes les foreign keys (performance des joins)
- Index sur les champs de recherche fréquents (status, category, dates)
- Index composite pour les requêtes complexes (listing_id + buyer_id)
- Index partiel pour les requêtes filtrées (`WHERE status = 'published'`)

### Triggers

1. **update_updated_at_column()**: Met à jour automatiquement `updated_at` sur profiles et listings
2. **update_thread_last_message_at()**: Met à jour `last_message_at` dans threads lors de l'insertion d'un message

### Scalabilité

#### Prévisions pour Jalon 2+:
- **Recherche full-text**: Ajout de Postgres full-text search ou Algolia
- **Notifications**: Table `notifications` avec triggers
- **Reviews/Ratings**: Table `reviews` liée aux orders
- **Favorites**: Table `favorites` pour les annonces favorites
- **Categories**: Table normalisée `categories` au lieu de string libre
- **Geolocation**: Utilisation de PostGIS pour recherches géospatiales avancées

### Performance

#### Optimisations prévues:
- Pagination systématique pour les listes (20 items par défaut)
- Indexes sur tous les champs de filtrage
- Relations chargées à la demande (pas de joins systématiques)
- Cache côté client pour les données fréquemment consultées

### Sécurité

#### Bonnes pratiques appliquées:
- RLS sur toutes les tables
- Validation des données côté client ET serveur (contraintes DB)
- Pas de données sensibles dans les tables publiques
- Cascade delete pour nettoyer les données orphelines

## Application du schéma

### Étapes:
1. Ouvrir Supabase Dashboard > SQL Editor
2. Exécuter `docs/supabase_schema.sql` (création des tables)
3. Exécuter `docs/supabase_rls.sql` (politiques RLS)
4. Vérifier dans Table Editor que les tables sont créées
5. Vérifier dans Authentication > Policies que les RLS sont actives

### Migration depuis l'ancien schéma:
- L'ancienne table `profiles` est compatible (champs ajoutés: display_name, avatar_url, updated_at)
- Les autres tables sont nouvelles, pas de migration nécessaire
