# Bloomi App

Application mobile Expo avec Supabase pour l'authentification et le backend.

## 🚀 Configuration des environnements

Le projet supporte 3 environnements distincts :

- **Development** : Développement local avec Expo Go
- **Staging** : Builds EAS avec le profile `preview` (utilise le projet Supabase staging)
- **Production** : Builds EAS avec le profile `production` (utilise le projet Supabase production)

## 📋 Prérequis

- Node.js (version recommandée dans `.nvmrc` si présent)
- npm ou yarn
- Expo CLI : `npm install -g expo-cli`
- EAS CLI : `npm install -g eas-cli`
- Compte Expo et projets Supabase configurés

## 🔧 Configuration initiale

### 1. Installation des dépendances

```bash
npm install
```

### 2. Configuration des variables d'environnement

#### Pour le développement local

1. Copiez le fichier `.env.example` vers `.env.local` :
   ```bash
   cp .env.example .env.local
   ```

2. Remplissez les valeurs dans `.env.local` avec vos identifiants Supabase de développement :
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://votre-projet-dev.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon-dev
   ```

3. Le fichier `.env.local` est automatiquement ignoré par Git (ne commitez jamais vos secrets !)

#### Pour les builds EAS (Staging et Production)

Les variables d'environnement pour les builds EAS doivent être configurées directement dans EAS.

**Option 1 : Via la ligne de commande**

```bash
# Pour staging (profile preview)
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://votre-projet-staging.supabase.co" --profile preview
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "votre-cle-staging" --profile preview

# Pour production
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://votre-projet-prod.supabase.co" --profile production
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "votre-cle-prod" --profile production
```

**Option 2 : Via le dashboard EAS**

1. Allez sur https://expo.dev
2. Sélectionnez votre projet
3. Allez dans **Settings** > **Secrets**
4. Ajoutez les variables pour chaque profile (preview et production)

## 🏃 Lancer l'application en développement

### Avec Expo Go (recommandé pour le développement)

```bash
npm start
```

Puis scannez le QR code avec :
- **iOS** : Appareil photo natif ou Expo Go
- **Android** : Expo Go

L'environnement sera automatiquement détecté comme `development` et utilisera les variables de `.env.local`.

## 📦 Builds EAS

### Build Staging (Preview)

Pour créer un build de staging qui utilise le projet Supabase staging :

```bash
# Build Android
eas build --profile preview --platform android

# Build iOS
eas build --profile preview --platform ios
```

Le profile `preview` définit automatiquement `EXPO_PUBLIC_ENV=staging`.

### Build Production

Pour créer un build de production qui utilise le projet Supabase production :

```bash
# Build Android
eas build --profile production --platform android

# Build iOS
eas build --profile production --platform ios
```

Le profile `production` définit automatiquement `EXPO_PUBLIC_ENV=production`.

## 📁 Structure de la configuration

### Fichiers de configuration

- **`lib/env.ts`** : Module centralisé qui exporte toutes les variables d'environnement
  - `ENV` : Environnement actuel (`development` | `staging` | `production`)
  - `SUPABASE_URL` : URL du projet Supabase
  - `SUPABASE_ANON_KEY` : Clé anonyme Supabase
  - `STRIPE_PUBLISHABLE_KEY` : Clé publique Stripe (optionnelle)
  - `DEV_OTP_MODE` : `true` uniquement en développement

- **`eas.json`** : Configuration des profiles EAS
  - `development` : Pour les builds de développement
  - `preview` : Pour les builds de staging
  - `production` : Pour les builds de production

- **`.env.example`** : Template des variables d'environnement (sans secrets)

### Utilisation dans le code

```typescript
import { ENV, SUPABASE_URL, DEV_OTP_MODE } from '@/lib/env';

if (DEV_OTP_MODE) {
  // Code spécifique au développement
}

console.log(`Environnement: ${ENV}`);
```

## 🔒 Sécurité

- ⚠️ **Ne jamais commiter** les fichiers `.env`, `.env.local` ou tout fichier contenant des secrets
- ✅ Les fichiers `.env*` sont automatiquement ignorés par Git (voir `.gitignore`)
- ✅ Utilisez EAS Secrets pour les variables d'environnement en staging/production
- ✅ Les variables `EXPO_PUBLIC_*` sont accessibles côté client (ne pas y mettre de secrets sensibles)

## 🧪 Mode de test en développement

En mode développement, vous pouvez tester l'authentification par SMS sans recevoir de vrai SMS en utilisant un code de test.

### Configuration Supabase pour le code de test

Pour que le code de test fonctionne, vous devez configurer votre projet Supabase :

1. Allez dans votre dashboard Supabase : https://supabase.com/dashboard
2. Sélectionnez votre projet de développement
3. Allez dans **Authentication** > **Phone Auth** > **Test Phone Numbers**
4. Dans le champ "Test Phone Numbers and OTPs", ajoutez votre numéro de test au format : `<numéro>=<code>`
   - **Format important** : Le numéro doit être **sans le préfixe `+`** et en format international
   - **Exemple** : `41791234567=123456` (pas `+41791234567=123456`)
   - Pour plusieurs numéros : `41791234567=123456,41791234568=123456`
5. Le code de test par défaut est `123456` (défini dans `lib/env.ts` via `DEV_TEST_CODE`)
6. Cliquez sur **Save** pour enregistrer la configuration

### Utilisation

1. Lancez l'app en mode développement : `npm start`
2. Entrez votre numéro de téléphone (celui configuré dans Supabase)
3. Sur l'écran de vérification, vous verrez une bannière jaune indiquant le code de test
4. Entrez le code `123456` au lieu d'attendre le SMS
5. Vous serez automatiquement connecté

**Note** : Le mode de test n'est disponible qu'en développement (`DEV_OTP_MODE = true`). Il est automatiquement désactivé en staging et production.

## 📚 Ressources

- [Documentation Expo](https://docs.expo.dev/)
- [Documentation EAS Build](https://docs.expo.dev/build/introduction/)
- [Documentation Supabase](https://supabase.com/docs)
- [Gestion des secrets EAS](https://docs.expo.dev/build-reference/variables/)
- [Supabase Phone Auth - Test Numbers](https://supabase.com/docs/guides/auth/phone-login#test-phone-numbers)
