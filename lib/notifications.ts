import { Platform } from 'react-native';
import Constants from 'expo-constants';
import i18n from './i18n';

let configured = false;

export async function ensureNotificationsConfigured() {
  if (configured) return;
  configured = true;

  // Expo Go (SDK 53+) n'inclut plus les push Android; et l'import direct de expo-notifications
  // déclenche un warning via l'auto-registration. On désactive dans Expo Go.
  if (Constants.appOwnership === 'expo') {
    return;
  }

  const Notifications = await import('expo-notifications');

  // Afficher les notifs même en foreground (iOS)
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });

  if (Platform.OS === 'web') return;

  const current = await Notifications.getPermissionsAsync();
  if (current.status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

export async function notifyNewMessage(params: {
  title?: string;
  body: string;
}) {
  if (Platform.OS === 'web') return;
  if (Constants.appOwnership === 'expo') return;
  const Notifications = await import('expo-notifications');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.title ?? i18n.t('notifications.newMessage'),
      body: params.body
    },
    trigger: null
  });
}

