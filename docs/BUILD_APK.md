# 📱 Guide : Créer une APK Android pour le client

Ce guide explique comment créer une APK Android que votre client peut installer et tester sur son téléphone.

## 📋 Prérequis

1. **EAS CLI installé** :
   ```bash
   npm install -g eas-cli
   ```

2. **Compte Expo** :
   - Créez un compte sur https://expo.dev si vous n'en avez pas
   - Connectez-vous : `eas login`

3. **Projet lié à Expo** :
   ```bash
   eas init
   ```
   (À faire une seule fois par projet)

## 🔧 Configuration des secrets EAS (pour le profile preview)

Avant de créer le build, vous devez configurer les variables d'environnement pour le profile `preview` (staging).

### Option 1 : Via la ligne de commande (recommandé)

```bash
# Configurez les secrets pour le profile preview
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://votre-projet-staging.supabase.co" --profile preview
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "votre-cle-staging" --profile preview
```

### Option 2 : Via le dashboard Expo

1. Allez sur https://expo.dev
2. Sélectionnez votre projet `bloomi-app`
3. Allez dans **Settings** > **Secrets**
4. Ajoutez les secrets pour le profile **preview** :
   - `EXPO_PUBLIC_SUPABASE_URL` = URL de votre projet Supabase staging
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = Clé anonyme de votre projet Supabase staging

## 🏗️ Créer le build Android

Une fois les secrets configurés, lancez :

```bash
eas build --profile preview --platform android
```

**Durée** : Le build prend généralement **10-20 minutes**. EAS va :
1. Préparer votre code
2. Créer l'APK Android
3. Vous envoyer un email quand c'est prêt

## 📥 Télécharger l'APK

Une fois le build terminé :

1. **Via l'email** : Cliquez sur le lien dans l'email reçu d'Expo
2. **Via le dashboard** : https://expo.dev → Votre projet → **Builds** → Téléchargez l'APK
3. **Via la ligne de commande** :
   ```bash
   eas build:list --platform android --profile preview
   ```
   Puis téléchargez l'APK depuis le lien fourni

## 📲 Installation sur le téléphone Android du client

### Méthode 1 : Partage direct (recommandé)

1. **Envoyez l'APK au client** :
   - Par email (pièce jointe)
   - Via Google Drive / Dropbox / WeTransfer
   - Via un lien de téléchargement direct

2. **Le client installe l'APK** :
   - Sur son téléphone Android, ouvre le fichier APK téléchargé
   - Si nécessaire, autorise l'installation depuis "Sources inconnues" :
     - **Paramètres** → **Sécurité** → Activez **Sources inconnues**
   - Suivez les instructions d'installation

### Méthode 2 : QR Code (si le client est à proximité)

1. **Générez un QR code** avec le lien de téléchargement de l'APK
2. Le client scanne le QR code avec son téléphone
3. Télécharge et installe l'APK

## ⚠️ Notes importantes

### Pour le client

- **Première installation** : Android peut demander d'autoriser l'installation depuis "Sources inconnues"
- **Mises à jour** : Pour installer une nouvelle version, désinstallez d'abord l'ancienne version, puis installez la nouvelle APK
- **Sécurité** : L'APK est signée par Expo, donc Android peut afficher un avertissement. C'est normal pour les builds de test.

### Pour vous (développeur)

- **Profile utilisé** : Le build utilise le profile `preview` (staging)
- **Variables d'environnement** : Assurez-vous que les secrets EAS sont bien configurés pour `preview`
- **Base de données** : Le build se connecte à votre projet Supabase **staging**
- **Table profiles** : Assurez-vous d'avoir exécuté le SQL `docs/supabase_profiles.sql` sur votre projet Supabase staging

## 🔄 Créer une nouvelle version

Pour créer une nouvelle version après des modifications :

```bash
# 1. Commitez vos changements
git add .
git commit -m "Nouvelle version pour le client"

# 2. Créez un nouveau build
eas build --profile preview --platform android
```

## 📊 Vérifier les builds

Liste de tous vos builds Android :

```bash
eas build:list --platform android --profile preview
```

## 🆘 Dépannage

### Erreur : "No EAS project found"

```bash
eas init
```

### Erreur : "Missing secrets"

Vérifiez que les secrets sont bien configurés :
```bash
eas secret:list --profile preview
```

### Le client ne peut pas installer l'APK

- Vérifiez que le téléphone autorise l'installation depuis "Sources inconnues"
- Vérifiez que l'APK n'est pas corrompue (re-téléchargez-la)
- Vérifiez que le téléphone a assez d'espace de stockage

## 📚 Ressources

- [Documentation EAS Build](https://docs.expo.dev/build/introduction/)
- [Gestion des secrets EAS](https://docs.expo.dev/build-reference/variables/)
- [Distribution interne Android](https://docs.expo.dev/build/internal-distribution/)
