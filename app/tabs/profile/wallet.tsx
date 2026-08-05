import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSafeBottomInset } from '../../../lib/safeArea';
import { Button } from '../../../components/ui/Button';
import { Text } from '../../../components/ui/Text';
import { AppIcon } from '../../../components/ui/AppIcon';
import { HeaderBackButton } from '../../../components/ui/HeaderBackButton';
import { supabase } from '../../../lib/supabase';
import { SUPABASE_URL } from '../../../lib/env';
import { theme } from '../../../lib/theme';
import { useAuthStore } from '../../../stores/authStore';
import { useTranslation } from 'react-i18next';

type WalletBalance = {
  available_chf: number;
  pending_chf: number;
};

type ProfileStripe = {
  stripe_connect_onboarding_completed: boolean | null;
  stripe_account_id: string | null;
  stripe_seller_account_id: string | null;
};

function formatChf(n: number) {
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toFixed(2)} CHF`;
}

function trimId(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

export default function WalletScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBottom = getSafeBottomInset(insets.bottom);
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [balance, setBalance] = useState<WalletBalance>({ available_chf: 0, pending_chf: 0 });
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [profileStripe, setProfileStripe] = useState<ProfileStripe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const userId = user?.id ?? null;

  const stripeAccountId = useMemo(() => {
    const row = profileStripe;
    return trimId(row?.stripe_account_id) ?? trimId(row?.stripe_seller_account_id);
  }, [profileStripe]);

  const onboardingCompleted = useMemo(
    () => Boolean(profileStripe?.stripe_connect_onboarding_completed),
    [profileStripe]
  );

  const loadProfileStripe = useCallback(async () => {
    if (!userId) return;
    const { data, error: qError } = await supabase
      .from('profiles')
      .select('stripe_connect_onboarding_completed, stripe_account_id, stripe_seller_account_id')
      .eq('id', userId)
      .maybeSingle();

    if (qError) throw new Error(qError.message);
    setProfileStripe((data ?? null) as ProfileStripe | null);
  }, [userId]);

  const loadBalance = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(t('feed.checkout.sessionExpired'));
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-wallet-balance`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const json = (await response.json()) as WalletBalance & { error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.error ?? json.details ?? t('profile.wallet.unableLoadBalance'));
      }

      const available = Number(json.available_chf);
      const pending = Number(json.pending_chf);
      setBalance({
        available_chf: Number.isFinite(available) ? available : 0,
        pending_chf: Number.isFinite(pending) ? pending : 0
      });
    } catch (e) {
      setBalance({ available_chf: 0, pending_chf: 0 });
      setError(e instanceof Error ? e.message : t('profile.wallet.unableLoadBalance'));
    } finally {
      setLoading(false);
    }
  }, [t, userId]);

  const reloadAll = useCallback(async () => {
    setSuccessMessage(null);
    await loadProfileStripe();
    // On charge le solde même si Stripe n'est pas activé: l'Edge Function renverra 0/0.
    await loadBalance();
  }, [loadBalance, loadProfileStripe]);

  useFocusEffect(
    useCallback(() => {
      void reloadAll();
    }, [reloadAll])
  );

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  const canPayout = balance.available_chf > 0 && onboardingCompleted;

  const openStripeDashboard = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error(t('feed.checkout.sessionExpired'));
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/get-dashboard-link`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const json = (await response.json()) as { url?: string; error?: string; details?: string };
      if (!response.ok) {
        throw new Error(json.error ?? json.details ?? t('profile.wallet.unableStripe'));
      }
      if (!json.url) {
        throw new Error(t('profile.wallet.missingStripeUrl'));
      }

      await Linking.openURL(json.url);
    } catch {
      Alert.alert(t('profile.wallet.stripe'), t('profile.wallet.unableStripe'));
    }
  }, [t]);

  const handlePayout = useCallback(async () => {
    if (!canPayout || payoutLoading) return;

    Alert.alert(
      t('profile.wallet.confirmPayout'),
      t('profile.wallet.confirmPayoutMessage', { amount: formatChf(balance.available_chf) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.wallet.transfer'),
          style: 'default',
          onPress: async () => {
            setPayoutLoading(true);
            setSuccessMessage(null);
            try {
              const { data: sessionData } = await supabase.auth.getSession();
              const accessToken = sessionData.session?.access_token;
              if (!accessToken) {
                throw new Error(t('feed.checkout.sessionExpired'));
              }

              const response = await fetch(`${SUPABASE_URL}/functions/v1/create-payout`, {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
              });

              const responseText = await response.text();
              let json: any = null;
              try {
                json = responseText ? JSON.parse(responseText) : null;
              } catch {
                json = null;
              }

              if (!response.ok || json?.success !== true) {
                throw new Error(json?.error ?? json?.details ?? responseText ?? t('profile.wallet.unableCreatePayout'));
              }

              setSuccessMessage(t('profile.wallet.payoutInitiated'));
              await loadBalance();
            } catch (e) {
              Alert.alert(t('common.error'), e instanceof Error ? e.message : t('profile.wallet.unableCreatePayout'));
            } finally {
              setPayoutLoading(false);
            }
          }
        }
      ]
    );
  }, [balance.available_chf, canPayout, loadBalance, payoutLoading, t]);

  const showPendingInfo = useCallback(() => {
    Alert.alert(
      t('profile.wallet.pendingFunds'),
      t('profile.wallet.pendingHint')
    );
  }, [t]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <HeaderBackButton onPress={() => router.back()} />
        <Text variant="body" style={styles.headerTitle}>
          {t('profile.walletScreenTitle')}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>
      <View style={styles.separator} />

      <View style={[styles.content, { paddingBottom: safeBottom + 80 }]}>
        {!userId ? (
          <View style={styles.center}>
            <Text variant="body" color="textSecondary" style={styles.centerText}>
              {t('profile.wallet.signInHint')}
            </Text>
            <Button title={t('profile.wallet.signIn')} onPress={() => router.push('/auth/login')} variant="primary" />
          </View>
        ) : !onboardingCompleted ? (
          <View style={styles.center}>
            <Text variant="body" style={styles.centerTitle}>
              {t('profile.wallet.activateHintTitle')}
            </Text>
            <Text variant="body" color="textSecondary" style={styles.centerText}>
              {t('profile.wallet.activateHintBody')}
            </Text>
            <Button
              title={t('sell.activateAccount')}
              onPress={() => router.push('/tabs/profile/activate-seller-account')}
              variant="primary"
              style={styles.activateSellerAccountButton}
            />
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text variant="captionSm" color="textSecondary" style={styles.label}>
                {t('profile.wallet.available')}
              </Text>
              {loading ? (
                <View style={styles.balanceLoadingRow}>
                  <ActivityIndicator color={theme.colors.textSecondary} />
                </View>
              ) : (
                <Text variant="h1" style={styles.availableAmount}>
                  {formatChf(balance.available_chf)}
                </Text>
              )}

              <View style={styles.pendingRow}>
                <View style={styles.pendingLabelRow}>
                  <Text variant="captionSm" color="textSecondary" style={styles.pendingLabel}>
                    {t('profile.wallet.pendingFunds')}
                  </Text>
                  <TouchableOpacity
                    onPress={showPendingInfo}
                    activeOpacity={0.8}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.infoIconBtn}
                  >
                    <AppIcon name="infoCircleOutline" size={18} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text variant="body" color="textPrimary" style={styles.pendingAmount}>
                  {formatChf(balance.pending_chf)}
                </Text>
              </View>

              {error ? (
                <Text variant="captionSm" color="textSecondary" style={styles.errorText}>
                  {error}
                </Text>
              ) : null}

              {successMessage ? (
                <View style={styles.successBox}>
                  <Text variant="body" style={styles.successText}>
                    {successMessage}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.actions}>
              <Button
                title={t('profile.wallet.transferToBank')}
                onPress={handlePayout}
                variant="primary"
                disabled={!canPayout}
                loading={payoutLoading}
              />
              <Button
                title={t('profile.wallet.openStripe')}
                onPress={openStripeDashboard}
                variant="secondary"
              />
            </View>
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
    paddingHorizontal: theme.spacing.settingsPaddingX,
    paddingVertical: theme.spacing.settingsHeaderPaddingY
  },
  headerTitle: {
    ...theme.typography.settingsHeaderTitle,
    color: theme.colors.appleBlack,
    textAlign: 'center',
    flex: 1
  },
  headerRightPlaceholder: {
    width: theme.spacing.settingsHeaderSideWidth
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: theme.spacing.gapMd
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: theme.colors.googleWhite
  },
  label: {
    marginBottom: 8
  },
  availableAmount: {
    color: theme.colors.textPrimary
  },
  balanceLoadingRow: {
    height: 44,
    justifyContent: 'center'
  },
  pendingRow: {
    marginTop: 14
  },
  pendingLabelRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  pendingLabel: {
    marginRight: 6
  },
  infoIconBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  pendingAmount: {
    marginTop: 4
  },
  actions: {
    marginTop: 16,
    gap: 10
  },
  successBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: theme.radius.card,
    backgroundColor: '#F9FFE8',
    borderWidth: 1,
    borderColor: theme.colors.primary
  },
  successText: {
    color: theme.colors.textPrimary
  },
  errorText: {
    marginTop: 10
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  centerTitle: {
    textAlign: 'center',
    marginBottom: 8
  },
  centerText: {
    textAlign: 'center',
    marginBottom: 16
  },
  activateSellerAccountButton: {
    paddingHorizontal: 20
  }
});

