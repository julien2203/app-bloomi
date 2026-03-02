# Polices Inter

Ce dossier doit contenir les fichiers de police Inter suivants :

- `Inter-Regular.ttf`
- `Inter-Medium.ttf`
- `Inter-SemiBold.ttf`
- `Inter-Bold.ttf`

## Comment obtenir les fichiers

### Option 1: Télécharger depuis Google Fonts

1. Aller sur https://fonts.google.com/specimen/Inter
2. Cliquer sur "Download family"
3. Extraire les fichiers `.ttf` du ZIP
4. Copier les fichiers suivants dans ce dossier :
   - `Inter-Regular.ttf` → `Inter-Regular.ttf`
   - `Inter-Medium.ttf` → `Inter-Medium.ttf`
   - `Inter-SemiBold.ttf` → `Inter-SemiBold.ttf`
   - `Inter-Bold.ttf` → `Inter-Bold.ttf`

### Option 2: Utiliser npm (temporaire)

Si vous ne pouvez pas télécharger les fichiers maintenant, vous pouvez utiliser temporairement `@expo-google-fonts/inter` qui est déjà installé.

Modifier `lib/ui/fonts.ts` pour utiliser :

```typescript
import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';

export function useInterFonts() {
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold
  });

  return { fontsLoaded, fontError };
}
```

## Vérification

Une fois les fichiers ajoutés, vérifier que :
- Les 4 fichiers `.ttf` sont présents dans `assets/fonts/`
- Les noms de fichiers correspondent exactement (sensible à la casse)
- L'app se lance sans erreur de chargement de police
