import { Linking } from 'react-native';
import type { Router } from 'expo-router';

export const PRIVACY_POLICY_URL = 'https://www.bloomi.ch/politique-de-confidentialite';

export const AUTH_TERMS_ROUTE = '/auth/legal' as const;

export function openPrivacyPolicy(): void {
  void Linking.openURL(PRIVACY_POLICY_URL);
}

export function openTermsOfUse(router: Pick<Router, 'push'>): void {
  router.push(AUTH_TERMS_ROUTE);
}
