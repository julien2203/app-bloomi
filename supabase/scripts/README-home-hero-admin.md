# Home hero — configuration admin

## Côté Supabase (une fois)

1. Appliquer la migration :
   ```bash
   npx supabase db push
   ```
   Ou exécuter `supabase/migrations/20260501120000_add_home_hero_config.sql` dans le SQL Editor.

2. Donner le rôle admin à ton compte (SQL Editor) :
   ```sql
   update public.profiles
   set is_admin = true
   where id = '<TON_USER_UUID>';
   ```

3. Vérifier la ligne publiée par défaut :
   ```sql
   select * from public.home_hero_config where id = 'default';
   ```

## Bucket Storage

- Nom : `home-hero` (public)
- Chemin recommandé pour l’image : `published/current.jpg` (ou `.webp` / `.png`)
- Enregistrer ce chemin dans `home_hero_config.image_path`

## Table `home_hero_config`

| Colonne | Description |
|---------|-------------|
| `id` | Toujours `default` |
| `headline_line_1` | Ligne 1 du titre **(français)** |
| `headline_line_2` | Ligne 2 du titre **(français)** |
| `headline_line_1_en` | Ligne 1 du titre **(anglais)** — si vide, libellé par défaut anglais dans l’app |
| `headline_line_2_en` | Ligne 2 du titre **(anglais)** — si vide, libellé par défaut anglais dans l’app |
| `cta_label` | Ignoré par l’app (bouton traduit via i18n : « Sell now » / « Vendre maintenant ») |
| `cta_route` | Route Expo Router, ex. `/tabs/sell` |
| `image_path` | Chemin dans le bucket `home-hero` |
| `is_published` | `true` = visible dans l’app mobile |

L’app mobile lit uniquement la ligne `default` avec `is_published = true`, et choisit les titres selon la langue de l’utilisateur (`fr` → colonnes sans suffixe, `en` → colonnes `_en`).

**Back-office :** pour chaque campagne, saisir les 4 champs titre (FR + EN). Si l’admin ne remplit que le français, les utilisateurs en anglais verront les textes par défaut (« Second hand » / « First choice ») jusqu’à publication d’une version EN.
