/**
 * Configuration des polices Inter
 * 
 * NOTE: Utilise temporairement @expo-google-fonts/inter jusqu'à ce que les fichiers
 * soient téléchargés dans assets/fonts/
 * 
 * Pour utiliser les fichiers locaux, remplacer par:
 * import { useFonts } from 'expo-font';
 * export function useInterFonts() {
 *   const [fontsLoaded, fontError] = useFonts({
 *     'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
 *     'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
 *     'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
 *     'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf')
 *   });
 *   return { fontsLoaded, fontError };
 * }
 */

import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold
} from '@expo-google-fonts/inter';

/**
 * Hook pour charger les polices Inter
 * À utiliser dans app/_layout.tsx
 * 
 * TODO: Une fois les fichiers téléchargés dans assets/fonts/, utiliser les fichiers locaux
 * Voir assets/fonts/README.md pour les instructions de téléchargement
 */
export function useInterFonts() {
  const [fontsLoaded, fontError] = useFonts({
    'Inter-Regular': Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold
  });

  return { fontsLoaded, fontError };
}
