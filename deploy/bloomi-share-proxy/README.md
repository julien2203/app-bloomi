# Configuration — pages de partage Bloomi (`bloomi.ch`)

## Diagnostic actuel (confirmé)

```bash
curl -sI https://bloomi.ch/listing/<uuid>
```

Réponse observée aujourd’hui :

- `HTTP/1.1 302 Found`
- `Location: https://…supabase.co/functions/v1/listing-share?id=…`
- `Content-Type: text/html; charset=iso-8859-1`

Conséquence : le navigateur (ou certains clients) affiche le HTML de la page de
partage comme **code source**, avec accents cassés (`Ã`, `â€™`, etc.), au lieu
de la page Bloomi rendue. L’URL quitte aussi `bloomi.ch`.

Les Edge Functions Supabase sont **OK** (`200` + `text/html; charset=utf-8`).
Le problème est uniquement côté **hébergement WordPress / Apache** : une
**redirection 302** au lieu d’un **proxy**.

## Solution recommandée sur WordPress (sans `mod_proxy`)

### 1. Déployer le dossier proxy

Sur le serveur, à la **racine web** (même niveau que `wp-config.php` /
`wp-content/`), créer :

```text
/bloomi-share/
  share-proxy.php
  well-known/
    apple-app-site-association
    assetlinks.json
```

Sources dans ce repo :

- `deploy/bloomi-share-proxy/wordpress/share-proxy.php`
- `deploy/bloomi-share-proxy/wordpress/well-known/*`

Remplacer dans les fichiers `.well-known` :

- `REPLACE_APPLE_TEAM_ID` → Team ID Apple (ex. `ABCDE12345`)
- `REPLACE_ANDROID_SHA256_FINGERPRINT` → empreinte SHA-256 du certificat Play Store

### 2. Modifier le `.htaccess` racine

**Avant** le bloc `# BEGIN WordPress`, coller le contenu de :

`deploy/bloomi-share-proxy/wordpress/htaccess-snippet.txt`

### 3. Supprimer l’ancienne redirection 302

Chercher et **supprimer** toute règle du type :

```apache
RedirectMatch ^/listing/(.*) https://…supabase.co/functions/v1/listing-share?id=$1
RedirectMatch ^/dressing/(.*) https://…supabase.co/functions/v1/closet-share?id=$1
```

ou `RewriteRule … [R=302]` / `[R]` vers `supabase.co` pour `/listing/` et
`/dressing/`.

Sans cette suppression, le 302 reste prioritaire et le bug continue.

### 4. Vérifier

```bash
curl -sI https://bloomi.ch/listing/<uuid-réel>
```

Attendu :

- `HTTP/1.1 200` (ou `404` / `410` si annonce absente)
- `Content-Type: text/html; charset=utf-8`
- **pas** de `302 Found`
- header optionnel `X-Bloomi-Share-Proxy: wordpress-php`
- l’URL reste `https://bloomi.ch/listing/…` dans le navigateur

```bash
curl -s https://bloomi.ch/listing/<uuid-réel> | head
```

Attendu : `<!DOCTYPE html>` rendu (fond vert clair, carte, CTA), pas du texte brut.

```bash
curl -sI https://bloomi.ch/.well-known/apple-app-site-association
curl -sI https://bloomi.ch/.well-known/assetlinks.json
```

Attendu : `200` + `Content-Type: application/json` (plus de 404 WordPress).

## Option alternative : reverse proxy Apache (`mod_proxy`)

Si vous avez un VPS avec `proxy` / `proxy_http` :

1. `a2enmod rewrite proxy proxy_http headers ssl`
2. Inclure `apache-bloomi-share.conf` dans le VirtualHost HTTPS
3. Copier `deploy/bloomi-well-known/` vers `/var/www/bloomi-well-known/`
4. Supprimer les Redirect 302 existants
5. `systemctl reload apache2`

## Secret Supabase (recommandé)

Dans **Supabase → Edge Functions → Secrets** :

```text
PUBLIC_SHARE_BASE_URL=https://bloomi.ch
```

Force les balises Open Graph (`og:url`) à pointer vers `bloomi.ch`.

## URLs supportées

| URL publique | Edge Function |
|---|---|
| `https://bloomi.ch/listing/{uuid}` | `listing-share?id={uuid}` |
| `https://bloomi.ch/dressing/{uuid}` | `closet-share?id={uuid}` |

## Côté app (déjà en place)

- Génération d’URL : `lib/listingShare.ts`, `lib/closetShare.ts`
- Deep links / Universal Links : `app/+native-intent.tsx`, `app.json`
- Pages HTML OG : `supabase/functions/listing-share`, `closet-share`, `_shared/sharePage.ts`
