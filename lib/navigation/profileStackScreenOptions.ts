import { Platform } from 'react-native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

/** Options header stack profil : pas de libellé « Profile » / « Settings » à côté de la flèche sur iOS. */
export const profileStackScreenOptions: NativeStackNavigationOptions = {
  headerTitleAlign: 'center',
  headerBackTitleVisible: false,
  headerBackTitle: '',
  animation: 'slide_from_right',
  ...(Platform.OS === 'ios' ? { headerBackButtonDisplayMode: 'minimal' } : {})
};

export function profileStackScreenWithBack(
  options: NativeStackNavigationOptions
): NativeStackNavigationOptions {
  return {
    ...profileStackScreenOptions,
    ...options
  };
}
