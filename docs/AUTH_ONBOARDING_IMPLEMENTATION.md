# Implémentation Auth/Onboarding - Bloomi App

## 📋 Résumé

Implémentation complète des 12 écrans d'authentification et d'onboarding selon les specs Figma (iPhone 375px).

## ✅ Fichiers créés

### Design System & Theme
- `lib/theme.ts` - Tokens design consolidés (colors, typography, spacing, radius)
- `lib/ui/colors.ts` - Couleurs Figma (déjà existant)
- `lib/ui/typography.ts` - Typographie Inter (déjà existant)
- `lib/ui/spacing.ts` - Espacements (déjà existant)
- `lib/ui/radius.ts` - Border radius (déjà existant)

### Composants UI réutilisables (`components/ui/`)
- `Button.tsx` - Bouton avec variants (primary-green, apple-black, google-white, facebook-blue, link)
- `TextField.tsx` - Champ de texte avec label, erreur, toggle password
- `Checkbox.tsx` - Case à cocher avec label personnalisable
- `Segmented.tsx` - Contrôle segmenté (Selling/Buying/Both)
- `DividerOr.tsx` - Séparateur "or"
- `ModalCard.tsx` - Modal avec blur overlay
- `Keypad.tsx` - Clavier numérique visuel (style iOS)
- `index.ts` - Export centralisé

### Écrans Onboarding (`app/onboarding/`)
- `_layout.tsx` - Layout avec Stack navigation
- `splash.tsx` - Écran splash vert avec logo "bloomi" et "SECOND HAND"
- `step-1.tsx` - Onboarding avec background photo + logo "b." + texte + CTA
- `step-2.tsx` - Onboarding avec boutons sociaux (Apple/Google/Facebook) + "or" + CTA vert
- `step-3.tsx` - Onboarding similaire avec autre background + lien "Log in"

### Écrans Auth (`app/auth/`)
- `login.tsx` - Email + password + "Forgot password?" + bouton "Log in" + social + "Sign up"
- `sign-up.tsx` - Full name, username, email, password, segmented (Selling/Buying/Both), checkboxes, bouton "Sign up"
- `forgot-password.tsx` - Email + bouton "Send reset link"
- `verify-email-illustration.tsx` - Gros titre + texte + bouton + "Learn more" + footer Terms/Privacy + "Log out"
- `verify-email-simple.tsx` - Input code + bouton "Verify" + lien "Didn't receive our email?"
- `verify-phone-info.tsx` - Titre + input phone + bouton "Verify phone number" + clavier numérique visuel
- `verify-phone-code.tsx` - Titre + texte + input code + bouton "Verify" + clavier numérique visuel
- `check-email-modal.tsx` - Modal "Check your email" avec icône mail dans cercle vert

### Assets
- `assets/onboarding/bg1.jpg` - Image placeholder pour onboarding step 1
- `assets/onboarding/bg2.jpg` - Image placeholder pour onboarding step 2
- `assets/onboarding/bg3.jpg` - Image placeholder pour onboarding step 3
- `assets/brand/.gitkeep` - Dossier pour logo Bloomi

### Navigation
- `app/index.tsx` - Mis à jour pour rediriger vers `/onboarding/splash` si non connecté
- `app/_layout.tsx` - Mis à jour pour permettre l'accès aux écrans onboarding/auth sans session
- `app/auth/_layout.tsx` - Mis à jour avec toutes les routes auth

## 🎨 Design System

### Couleurs
- `primary`: #C3EA4F (vert primaire)
- `appleBlack`: #000000
- `googleWhite`: #FFFFFF
- `facebookBlue`: #425B90
- `textPrimary`: #111111
- `textSecondary`: #6B7280
- `backgroundWhite`: #FFFFFF

### Typographie
- Police: Inter (Regular, Medium, SemiBold, Bold)
- `h1`: 28px, SemiBold
- `h2`: 22px, SemiBold
- `body`: 16px, Regular
- `caption`: 14px, Regular
- `button`: 16px, SemiBold

### Spacing
- `horizontalPadding`: 16px
- `buttonHeight`: 56px

### Border Radius
- `buttonRadius`: 12px
- `cardRadius`: 12px

## 🔄 Flow de navigation

### Nouvel utilisateur (non connecté)
1. `app/index.tsx` → `/onboarding/splash`
2. `/onboarding/splash` (2s) → `/onboarding/step-1`
3. `/onboarding/step-1` → `/onboarding/step-2` (via CTA)
4. `/onboarding/step-2` → `/auth/sign-up` (via CTA) OU social login
5. `/onboarding/step-3` → `/auth/login` (via lien) OU `/auth/sign-up` (via CTA)

### Inscription
1. `/auth/sign-up` → `/auth/verify-email-illustration` (après submit)
2. `/auth/verify-email-illustration` → `/auth/verify-email-simple` (via bouton)
3. `/auth/verify-email-simple` → `/tabs/feed` (après vérification)

### Connexion
1. `/auth/login` → `/tabs/feed` (après connexion réussie)
2. `/auth/login` → `/auth/forgot-password` (via lien)
3. `/auth/forgot-password` → `/auth/login` (après envoi)

### Vérification téléphone
1. `/auth/verify-phone-info` → `/auth/verify-phone-code` (après saisie téléphone)
2. `/auth/verify-phone-code` → `/tabs/feed` (après vérification code)

### Utilisateur connecté
- Redirection automatique vers `/tabs/feed` depuis n'importe quel écran auth/onboarding

## 📝 TODOs / Améliorations futures

### Assets manquants
- [ ] Remplacer `assets/onboarding/bg1.jpg`, `bg2.jpg`, `bg3.jpg` par les vraies images Figma
- [ ] Ajouter `assets/brand/bloomi-logo.png` (logo complet)
- [ ] Ajouter `assets/brand/logo-b.png` (logo "b." simple)
- [ ] Ajouter illustration pour `verify-email-illustration.tsx`

### Logique métier à implémenter
- [ ] Connexion sociale (Apple/Google/Facebook) dans `onboarding/step-2.tsx` et `onboarding/step-3.tsx`
- [ ] Logique de connexion dans `auth/login.tsx`
- [ ] Logique d'inscription dans `auth/sign-up.tsx`
- [ ] Envoi de lien de réinitialisation dans `auth/forgot-password.tsx`
- [ ] Vérification du code email dans `auth/verify-email-simple.tsx`
- [ ] Vérification du téléphone dans `auth/verify-phone-info.tsx`
- [ ] Vérification du code téléphone dans `auth/verify-phone-code.tsx`
- [ ] Déconnexion dans `auth/verify-email-illustration.tsx`

### Textes à finaliser
- [ ] Remplacer les textes placeholder dans les écrans onboarding par les textes exacts Figma
- [ ] Vérifier tous les textes avec les maquettes Figma

### UX/UI
- [ ] Ajouter animations de transition entre écrans (fade/slide)
- [ ] Améliorer le clavier numérique visuel (Keypad) pour correspondre exactement à iOS
- [ ] Ajuster les espacements selon les specs Figma précises
- [ ] Vérifier le rendu sur différentes tailles d'écran (responsive)

## 🧪 Comment tester

### 1. Tester le flow complet
```bash
# Lancer l'app
npm start

# Flow nouveau utilisateur:
# 1. App démarre → Splash (2s) → Onboarding Step 1
# 2. Cliquer "Sign up for Bloomi" → Onboarding Step 2
# 3. Cliquer "Sign up with email" → Sign Up
# 4. Remplir le formulaire → Verify Email Illustration
# 5. Cliquer "Get my verification code" → Verify Email Simple
# 6. Entrer code (mock) → Feed
```

### 2. Tester les écrans individuellement
- Naviguer directement vers `/onboarding/splash`, `/auth/login`, `/auth/sign-up`, etc.
- Vérifier que tous les boutons/liens fonctionnent
- Tester le clavier numérique visuel dans `/auth/verify-phone-info` et `/auth/verify-phone-code`

### 3. Tester la navigation
- Se connecter → Vérifier redirection vers `/tabs/feed`
- Se déconnecter → Vérifier redirection vers `/onboarding/splash`
- Accéder à `/auth/login` en étant connecté → Vérifier redirection vers `/tabs/feed`

## 🐛 Problèmes connus

1. **Images placeholder**: Les images d'onboarding sont des copies de `icon.png`. Remplacer par les vraies images Figma.
2. **Logique mockée**: Toutes les actions (login, signup, verify) sont mockées avec des `setTimeout`. Implémenter la vraie logique Supabase.
3. **Clavier numérique**: Le clavier numérique visuel est fonctionnel mais peut nécessiter des ajustements de style pour correspondre exactement à iOS.

## 📚 Références

- Design System: `lib/theme.ts`
- Composants UI: `components/ui/`
- Écrans Onboarding: `app/onboarding/`
- Écrans Auth: `app/auth/`
