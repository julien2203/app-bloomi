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
import {
  isStripeConnectReturnUrl,
  markStripeConnectReturnPending,
  navigateAfterStripeConnectReturn,
  navigateInTabs
} from '../../../lib/navigation/navigateInTabs';
import { useTranslation } from 'react-i18next';

type StripeOnboardingStatus =
  | { type: 'checking' }
  | { type: 'idle'; message: string }
  | { type: 'success'; message: string; pendingReview?: boolean }
  | { type: 'error'; message: string };

export default function ActivateSellerAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StripeOnboardingStatus | null>(null);

  const userId = user?.id ?? null;

  const checkStripeOnboarding = useCallback(async () => {
    if (!userId) return;

    setStatus({ type: 'checking' });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(t('feed.checkout.sessionExpired'));
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
            t('profile.activateSeller.checkError')
        );
      }

      const completed = Boolean((data as any)?.completed);
      const pendingReview = Boolean((data as any)?.pending_stripe_review);
      if (completed) {
        setStatus({
          type: 'success',
          message: pendingReview
            ? t('profile.activateSeller.pendingReview')
            : t('profile.activateSeller.activated'),
          pendingReview
        });
      } else {
        const currentlyDue = (data as { currently_due?: string[] })?.currently_due ?? [];
        setStatus({
          type: 'idle',
          message:
            currentlyDue.length > 0
              ? t('profile.activateSeller.incompleteOnboarding')
              : t('profile.activateSeller.notActivated')
        });
      }
    } catch {
      setStatus({
        type: 'error',
        message: t('profile.activateSeller.checkError')
      });
    }
  }, [t, userId]);

  useFocusEffect(
    useCallback(() => {
      void checkStripeOnboarding();
    }, [checkStripeOnboarding])
  );

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const url = event?.url;
      if (isStripeConnectReturnUrl(url)) {
        navigateAfterStripeConnectReturn();
        void checkStripeOnboarding();
      }
    });

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (isStripeConnectReturnUrl(initialUrl)) {
        navigateAfterStripeConnectReturn();
        void checkStripeOnboarding();
      }
    })();

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
        message: t('profile.activateSeller.openingStripe')
      });

      // Appelle l'Edge Function côté Supabase.
      // Le nom correspond à la config: [functions.create-connect-account]
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(t('feed.checkout.sessionExpired'));
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

      if (!response.ok || !url) {
        const err = (data as { error?: string; details?: string })?.error ?? 'Request failed';
        const details = (data as { details?: string })?.details;
        throw new Error(details ? `${err}: ${details}` : err);
      }

      await markStripeConnectReturnPending();
      await Linking.openURL(url);
      // À l'arrivée dans l'app : deep link, marqueur AsyncStorage ou `useFocusEffect`.
    } catch (e) {
      setStatus({
        type: 'error',
        message:
          e instanceof Error
            ? `Unable to start Stripe onboarding: ${e.message}`
            : t('profile.activateSeller.unableStartOnboarding')
      });
    } finally {
      setLoading(false);
    }
  }, [loading, t, userId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
            {t('sell.activateAccount')}
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
              {t('profile.activateSeller.activatedTitle')}
            </Text>
            <Text variant="body" color="textSecondary" style={styles.successSubtitle}>
              {status.pendingReview
                ? t('profile.activateSeller.pendingReviewSubtitle')
                : t('profile.activateSeller.activatedSubtitle')}
            </Text>

            <View style={styles.successActions}>
              <Button
                title={t('profile.activateSeller.openWallet')}
                onPress={() => navigateInTabs('/tabs/profile/wallet')}
                variant="primary"
              />
              <Button
                title={t('profile.activateSeller.backToProfile')}
                onPress={() => navigateInTabs('/tabs/profile')}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <>
            <Text variant="body" color="textSecondary" style={styles.description}>
              {t('profile.activateSeller.connectDescription')}
            </Text>

            <View style={styles.buttonContainer}>
              <Button
                title={t('profile.activateSeller.connectBank')}
                onPress={handleConnect}
                disabled={!canConnect}
                loading={loading}
                variant="primary"
              />
            </View>

            {status ? (
              <View style={styles.statusContainer}>
                {status.type === 'checking' ? (
                  <ActivityIndicator size="small" color={theme.colors.textSecondary} />
                ) : null}
                {status.type !== 'checking' ? (
                  <Text
                    variant="body"
                    style={[
                      styles.statusText,
                      status.type === 'error' && { color: theme.colors.danger }
                    ]}
                  >
                    {status.message}
                  </Text>
                ) : (
                  <Text variant="body" color="textSecondary" style={styles.statusText}>
                    {t('profile.activateSeller.checking')}
                  </Text>
                )}
              </View>
            ) : null}

            {status?.type === 'idle' ? (
              <View style={styles.retryContainer}>
                <Button
                  title={t('profile.activateSeller.retryCheck')}
                  onPress={() => void checkStripeOnboarding()}
                  variant="secondary"
                  disabled={loading}
                />
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
  retryContainer: {
    marginTop: theme.spacing.gapMd
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

