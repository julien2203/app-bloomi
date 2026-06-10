# Supprimer les données de test Supabase (Bloomi)

## 1. Base de données (SQL)

1. Ouvre [Supabase Dashboard](https://supabase.com/dashboard) → ton projet → **SQL** → **New query**.
2. Ouvre le fichier [`wipe-test-data.sql`](./wipe-test-data.sql) dans ce repo.
3. Choisis **une** option :
   - **Option A** : vide annonces, messages, commandes, likes, signalements, etc. **Les comptes login restent.**
   - **Option B** : comme A + **supprime tous les utilisateurs** (`auth.users`).
   - **Option C** : supprime seulement des emails de test (filtre à adapter).
4. Décommente le bloc `BEGIN;` … `COMMIT;` choisi (enlever `/*` et `*/`).
5. Clique **Run**.
6. La requête de vérification en bas du fichier doit afficher des `0` sur les tables vidées.

> Si une table n’existe pas chez toi (ex. `listing_views`), commente la ligne `DELETE` correspondante ou dis-moi l’erreur exacte.

## 2. Storage (photos, avatars, covers)

Les fichiers ne sont **pas** supprimés par le SQL.

1. Dashboard → **Storage**
2. Buckets à vider en général :
   - `listings` (photos d’annonces)
   - `avatars`
   - `cover`
3. Pour chaque bucket : sélectionner les fichiers → **Delete**, ou vider le bucket si l’UI le permet.

## 3. Stripe (si tu as testé des paiements)

Les PaymentIntents / comptes Connect de test restent côté **Stripe Dashboard** (mode test). Ce n’est pas lié à Supabase ; tu peux les ignorer ou les nettoyer dans Stripe si besoin.

## 4. Recharger l’app

Après le nettoyage : force-quit l’app ou **pull-to-refresh** sur le feed. Déconnecte-toi / reconnecte-toi si des écrans affichent encore du cache local.

## Ce qui n’est **pas** supprimé (volontairement)

Tables de référence : `categories`, `brands`, `sizes`, `colors`, `conditions` — elles alimentent les filtres et ne sont en principe pas des « données de test » utilisateur.
