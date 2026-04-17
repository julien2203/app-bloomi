import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/ui/Button';
import { Text } from '../../../components/ui/Text';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { AppIcon } from '../../../components/ui/AppIcon';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';

type StripeOnboardingStatus =
  | { type: 'idle'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string };

export default function ActivateSellerAccountScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StripeOnboardingStatus | null>(null);

  const userId = user?.id ?? null;

  const checkStripeOnboarding = useCallback(async () => {
    if (!userId) return;

    setStatus({ type: 'idle', message: 'Checking your seller account status…' });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Session expired, please log in again.');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/check-connect-status`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          (data as any)?.error ??
            (data as any)?.details ??
            'Unable to check your Stripe status. Please try again.'
        );
      }

      const completed = Boolean((data as any)?.completed);
      if (completed) {
        setStatus({
          type: 'success',
          message: 'Seller account successfully activated. Thank you!'
        });
      } else {
        setStatus({
          type: 'idle',
          message: 'Your seller account is not activated yet.'
        });
      }
    } catch {
      setStatus({
        type: 'error',
        message: 'An error occurred while checking your status.'
      });
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void checkStripeOnboarding();
    }, [checkStripeOnboarding])
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const url = (event as any)?.url;
      // Le Edge Function renvoie `return_url: "bloomi://profile"`.
      if (typeof url === 'string' && url.startsWith('bloomi://profile')) {
        void checkStripeOnboarding();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkStripeOnboarding]);

  const canConnect = useMemo(() => Boolean(userId), [userId]);

  const handleConnect = useCallback(async () => {
    if (!userId) return;
    if (loading) return;

    setLoading(true);
    try {
      setStatus({
        type: 'idle',
        message: 'Opening Stripe Connect onboarding…'
      });

      // Appelle l'Edge Function côté Supabase.
      // Le nom correspond à la config: [functions.create-connect-account]
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error('Session expired, please log in again.');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-connect-account`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({})
        }
      );

      const data = await response.json();
      const url: string | null = (data as any)?.url ?? null;

      if (!url) {
        throw new Error(
          (data as any)?.error ??
            (data as any)?.details ??
            'Missing Stripe URL in create-connect-account response.'
        );
      }

      await Linking.openURL(url);
      // À l'arrivée dans l'app, `useFocusEffect` recalcule le statut.
    } catch (e) {
      setStatus({
        type: 'error',
        message:
          e instanceof Error
            ? `Unable to start Stripe onboarding: ${e.message}`
            : 'Unable to start Stripe onboarding. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  }, [loading, userId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          Activate my seller account
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.headerSeparator} />

      <View style={styles.content}>
        {status?.type === 'success' ? (
          <View style={styles.successWrap}>
            <View style={styles.successIconCircle}>
              <AppIcon name="checkCircleBold" size={28} color={theme.colors.appleBlack} />
            </View>
            <Text variant="h2" style={styles.successTitle}>
              Seller account activated
            </Text>
            <Text variant="body" color="textSecondary" style={styles.successSubtitle}>
              You can sell on Bloomi and receive payouts
            </Text>

            <View style={styles.successActions}>
              <Button
                title="Open my Wallet"
                onPress={() => router.replace('/tabs/profile/wallet')}
                variant="primary"
              />
              <Button
                title="Back to profile"
                onPress={() => router.replace('/tabs/profile')}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <>
            <Text variant="body" color="textSecondary" style={styles.description}>
              Connect your Stripe Connect account to receive payouts for your sales.
            </Text>

            <View style={styles.buttonContainer}>
              <Button
                title="Connect my bank account"
                onPress={handleConnect}
                disabled={!canConnect}
                loading={loading}
                variant="primary"
              />
            </View>

            {status ? (
              <View style={styles.statusContainer}>
                {status.type === 'idle' ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : null}
                <Text
                  variant="body"
                  style={[
                    styles.statusText,
                    status.type === 'success' && { color: theme.colors.primary },
                    status.type === 'error' && { color: theme.colors.danger }
                  ]}
                >
                  {status.message}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerRightPlaceholder: {
    width: 40
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapLg,
    justifyContent: 'flex-start'
  },
  description: {
    marginBottom: theme.spacing.gapLg
  },
  buttonContainer: {
    marginBottom: theme.spacing.gapMd
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  statusText: {
    flex: 1
  },
  successWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: 8
  },
  successSubtitle: {
    textAlign: 'center',
    marginBottom: 24
  },
  successActions: {
    width: '100%',
    gap: 10
  }
});

