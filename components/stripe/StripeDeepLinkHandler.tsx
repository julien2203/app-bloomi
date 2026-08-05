import { useCallback, useEffect } from 'react';
import { Linking } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';

/**
 * Après 3DS / validation bancaire, Stripe redirige vers `bloomi://stripe-redirect`.
 * Sans `handleURLCallback`, la webview reste blanche jusqu’à fermeture manuelle.
 */
export function StripeDeepLinkHandler() {
  const { handleURLCallback } = useStripe();

  const handleDeepLink = useCallback(
    async (url: string | null | undefined) => {
      if (!url) return;
      try {
        await handleURLCallback(url);
      } catch {
        // Non-Stripe URL ou SDK déjà traité — ignoré
      }
    },
    [handleURLCallback]
  );

  useEffect(() => {
    void Linking.getInitialURL().then((url) => handleDeepLink(url));

    const subscription = Linking.addEventListener('url', (event) => {
      void handleDeepLink(event.url);
    });

    return () => subscription.remove();
  }, [handleDeepLink]);

  return null;
}
