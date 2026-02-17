# Jalon 1 – Bloomi (DONE)

Ce document décrit l'état de l'application à la fin du Jalon 1 et les actions à réaliser côté Supabase.

## ✅ Checklist fonctionnelle

- [x] Authentification par téléphone via Supabase (OTP SMS)
- [x] Support des pays **CH / FR / DE / IT** uniquement
- [x] Écran de connexion (saisie téléphone) et écran de vérification OTP
- [x] Mode de test OTP en développement (code fixe)
- [x] Gestion de session (connexion / déconnexion) avec Zustand
- [x] Navigation à onglets (Feed, Sell, Messages, Profile)
- [x] Multi-environnements **DEV / STAGING / PROD** (Expo + EAS + Supabase)
- [x] Création / synchronisation d’un profil applicatif (`profiles`) au login
- [x] Lecture du profil (phone + country) dans l’onglet **Profile**
- [x] RLS minimale sur la table `profiles`

## 🧩 Résumé technique

- **Auth** : `supabase.auth.signInWithOtp` + `verifyOtp` (SMS)
- **Téléphone** :
  - Helper : `lib/phone.ts` → `normalizePhoneToE164`
  - Pays acceptés : `+41`, `+33`, `+49`, `+39`
  - Retour : `{ ok, value (E.164), country }`
- **Profils** :
  - Helper : `lib/profile.ts` → `ensureProfileExists`, `getProfileForUser`
  - Table : `public.profiles` (SQL fourni ci-dessous)
  - Création automatique :
    - après login (via `onAuthStateChange` dans `app/_layout.tsx`)
    - après restauration de session (`restoreSession` dans `stores/authStore.ts`)
- **Profile UI** :
  - `app/(tabs)/profile/index.tsx` affiche :
    - `phone` (depuis `profiles` ou fallback `user.phone`)
    - `country` (CH/FR/DE/IT)

## 🗄️ Mise en place Supabase (table `profiles` + RLS)

1. Ouvrir le **Dashboard Supabase** :  
   `https://supabase.com/dashboard`
2. Sélectionner votre projet Bloomi (DEV, STAGING ou PROD selon le contexte).
3. Dans le menu de gauche, aller dans **SQL** → **New query**.
4. Copier-coller le contenu de `docs/supabase_profiles.sql` dans l’éditeur :

```sql
-- Table des profils applicatifs
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text,
  country text,
  created_at timestamptz not null default timezone('utc', now())
);

-- Activer RLS
alter table public.profiles enable row level security;

-- Politique de lecture : chaque utilisateur ne peut lire que son profil
create policy "Profiles are viewable by owner"
on public.profiles
for select
using (auth.uid() = id);

-- Politique d'insertion : chaque utilisateur ne peut insérer que son propre profil
create policy "Profiles can be inserted by owner"
on public.profiles
for insert
with check (auth.uid() = id);

-- Politique de mise à jour : chaque utilisateur ne peut modifier que son profil
create policy "Profiles can be updated by owner"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);
```

5. Cliquer sur **Run** / **Execute** pour appliquer le script.
6. Vérifier dans **Table editor** que la table `profiles` est bien créée.

> À faire **pour chaque projet Supabase** (DEV, STAGING, PROD) : exécuter le même script SQL.

## ☎️ Configuration téléphone multi-pays

### Formats acceptés

Pour les pays **CH / FR / DE / IT**, les formats suivants sont acceptés :

- `+41 79 123 45 67`, `0041 79 123 45 67`, `41791234567` (Suisse)
- `+33 6 12 34 56 78`, `0033 6 12 34 56 78`, `33612345678` (France)
- `+49 151 1234567`, `0049 151 1234567`, `491511234567` (Allemagne)
- `+39 347 1234567`, `0039 347 1234567`, `393471234567` (Italie)

Si l’utilisateur entre un numéro local commençant par `0` (ex: `079...`), un message lui demande de saisir le numéro au format international (`+41...`, etc.).

Tout numéro en dehors de ces 4 pays renvoie une erreur explicite :

> « Seuls les numéros suisses (+41), français (+33), allemands (+49) et italiens (+39) sont acceptés. »

## 🧪 Mode OTP de test (DEV)

Rappel rapide (déjà détaillé dans le `README.md`) :

1. Dans Supabase : **Authentication** → **Phone Auth** → **Test Phone Numbers**
2. Renseigner vos numéros de test sous la forme :  
   `41791234567=123456`
3. Le code de test est défini dans `lib/env.ts` (`DEV_TEST_CODE`).
4. En développement (`npm start`), l’écran de vérification affiche une bannière jaune avec le code de test.

## 🔌 Comment tester la fin du Jalon 1

### 1. Démarrer l’app en développement

```bash
npm install        # si ce n'est pas déjà fait
npm start
```

Assurez-vous que `.env.local` est configuré avec votre projet Supabase DEV.

### 2. Tester l’authentification multi-pays

1. Sur l’écran de connexion, entrer un numéro au format international :
   - Suisse : `+41...`
   - France : `+33...`
   - Allemagne : `+49...`
   - Italie : `+39...`
2. Vérifier que les autres pays sont refusés avec un message clair.
3. Continuer le flow jusqu’à l’écran OTP (via SMS réel ou code de test).

### 3. Vérifier la création du profil

1. Une fois connecté, aller dans l’onglet **Profile**.
2. Vous devriez voir :
   - **Téléphone** : le numéro au format E.164 (`+41...`, etc.)
   - **Pays** : `CH`, `FR`, `DE` ou `IT`
3. Dans Supabase → **Table editor** → `profiles`, vérifier que :
   - Une ligne est créée avec `id = auth.user.id`
   - `phone` et `country` sont remplis

### 4. Vérifier la RLS

1. Dans Supabase, créer un second utilisateur de test.
2. Connectez-vous avec ce second compte dans l’app.
3. Vérifiez dans la table `profiles` que :
   - Chaque utilisateur ne voit que **son** profil via l’API
   - Les politiques RLS sont bien actives (via l’onglet **Auth** → **Policies**).

## 📂 Fichiers clés modifiés/ajoutés pour le Jalon 1

- `lib/phone.ts` : normalisation E.164 multi-pays (CH/FR/DE/IT)
- `app/(auth)/sign-in.tsx` : support multi-pays + messages d’erreur
- `lib/profile.ts` : `ensureProfileExists` + `getProfileForUser`
- `stores/authStore.ts` : création de profil lors de `restoreSession`
- `app/_layout.tsx` : création de profil lors des changements d’auth
- `app/(tabs)/profile/index.tsx` : affichage `phone` + `country`
- `docs/supabase_profiles.sql` : table `profiles` + RLS
- `docs/JALON_1_DONE.md` : ce guide de clôture de Jalon 1

