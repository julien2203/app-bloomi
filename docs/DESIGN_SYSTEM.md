## Design system Bloomi

Le design system est centralisé dans `lib/theme.ts`. C’est **la seule source de vérité** pour:

- **Couleurs**: `theme.colors.*` (primary, textPrimary, border, background, danger, etc.)
- **Typographie**: `theme.typography.*` + `theme.fontFamily.*`
- **Espacements**: `theme.spacing.*` (screenPaddingX, buttonHeight, gapSm/Md/Lg)
- **Radius**: `theme.radius.*` (button, card, input)
- **Ombres**: `theme.shadows.*`

### Composants UI à utiliser

- `components/ui/Button`  
  Variants: `primary`, `secondary`, `apple`, `google`, `facebook`, `link`.  
  Hauteur, radius, typo et couleurs viennent du thème.

- `components/ui/TextField`  
  Champs texte avec label, bordures et messages d’erreur basés sur le thème.

- `components/ui/Checkbox`, `components/ui/Segmented`, `components/ui/DividerOr`, `components/ui/ModalCard`  
  Tous consomment `theme` pour couleurs, radius et typo.

- `components/ui/Screen`  
  Wrapper d’écran standard:
  - SafeAreaView
  - `background = theme.colors.background`
  - padding horizontal = `theme.spacing.screenPaddingX`
  - prop `scroll` pour activer un `ScrollView` avec contentPadding cohérent.

- `components/ui/Text`  
  Wrapper autour de `Text` React Native:
  - `variant`: `h1 | h2 | h3 | body | caption | button`
  - `color`: clé de `theme.colors` (`'textPrimary'`, `'textSecondary'`, etc.)

### Règles d’utilisation

- Dans `app/**` et `components/**` :
  - **interdit** d’écrire des couleurs hex (`#C3EA4F`, `#111827`, etc.)  
  - **interdit** d’écrire des `fontSize` / `fontWeight` numériques, sauf cas exceptionnel **commenté** et justifié.
  - toujours passer par `theme` ou les composants UI ci-dessus.

- `lib/theme.ts` est le seul endroit où:
  - de nouvelles couleurs ou tailles peuvent être ajoutées,
  - des valeurs Figma sont encodées.

### Vérification automatisée

Le script suivant vérifie les violations les plus courantes:

```bash
npm run design:check
```

Il échoue si:

- une couleur hex (`#[0-9a-fA-F]{3,8}`) est trouvée dans `app/**` ou `components/**`
- un `fontSize: <nombre>` est trouvé dans `app/**`
- un `fontWeight: <nombre>` est trouvé dans `app/**`

En cas d’erreur, le script affiche les lignes incriminées; il faut alors remplacer ces valeurs par des tokens du thème ou par les composants UI du design system.

