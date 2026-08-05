import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Met à jour la pastille rouge sur l’icône de l’app (iOS + launchers Android compatibles).
 * 0 = masquer le badge.
 */
export async function syncAppIconBadge(count: number): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Constants.appOwnership === 'expo') return;

  const n = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));

  try {
    const Notifications = await import('expo-notifications');
    await Notifications.setBadgeCountAsync(n);
  } catch {
    // Launcher Android non supporté / permission manquante : ignorer.
  }
}
