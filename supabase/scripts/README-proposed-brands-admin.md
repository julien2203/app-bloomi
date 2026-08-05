# Marques proposées — admin

Les vendeurs peuvent saisir une marque **libre** sur une annonce (`listings.brand`) si elle n’est pas dans le catalogue. Ces marques n’entrent **pas** automatiquement dans `brands`.

## Prérequis

1. Appliquer la migration :
   ```bash
   npx supabase db push
   ```
   ou exécuter `supabase/migrations/20260801140000_proposed_brands_admin.sql` dans le SQL Editor.

2. Compte admin :
   ```sql
   update public.profiles
   set is_admin = true
   where id = '<TON_USER_UUID>';
   ```

## Lister les propositions

Dans le SQL Editor (session authentifiée admin, ou via RPC depuis un back-office) :

```sql
select * from public.admin_list_proposed_brands();
```

Colonnes :
| Colonne | Description |
|---------|-------------|
| `brand_key` | Clé normalisée (minuscules, espaces réduits) |
| `display_name` | Libellé le plus fréquent trouvé sur les annonces |
| `listings_count` | Nombre d’annonces avec cette variante |
| `sample_listing_ids` | Jusqu’à 20 ids d’annonces concernées |

## Ajouter au catalogue

```sql
select public.admin_promote_proposed_brand(
  'Nom Canonique',  -- libellé catalogue
  'all',            -- gender: femme|homme|enfant|bebe|all
  'all',            -- type: vetements|chaussures|sacs|accessoires|…|all
  true              -- réécrire listings.brand vers ce libellé
);
```

## Fusionner vers une marque existante

Ex. `Zara Home` → `Zara` :

```sql
select public.admin_merge_brand_into('Zara Home', 'Zara');
```

## Notes produit

- Les filtres marque catalogue ne listent que `brands` ; une marque libre n’y apparaît qu’après promotion.
- Le libellé reste visible sur l’annonce et dans les recherches texte.
- « Autre » / « Other » sont exclus des propositions (marque générique).
