/**
 * Onboarding Step 2
 * Fond blanc + logo + boutons social (Apple/Google/Facebook) + "or" + CTA vert
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../components/ui/Button';
import { DividerOr } from '../../components/ui/DividerOr';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import {
  ensureProfileAfterOAuthLogin,
  isOAuthCancelled,
  signInWithOAuthProvider,
  type OAuthProvider
} from '../../lib/socialAuth';
import { useTranslation } from 'react-i18next';
import { authDebug, authDebugError } from '../../lib/authDebugLog';
import { openPrivacyPolicy, openTermsOfUse } from '../../lib/legalLinks';
import { postAuthDestination } from '../../lib/auth/needsPhoneVerification';

export default function OnboardingStep2() {
  const { t } = useTranslation();
  const router = useRouter();
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSocialLogin = async (provider: 'apple' | 'google' | 'facebook') => {
    if (provider === 'facebook') {
      Alert.alert(t('onboarding.social.facebook'), t('onboarding.social.facebookSoon'));
      return;
    }
    if (oauthLoading) return;

    setOauthLoading(true);
    authDebug('onboarding:oauth:start', { provider, step: 2 });

    try {
      const oauthProvider = provider as OAuthProvider;
      const { error } = await signInWithOAuthProvider(oauthProvider);

      if (error) {
        const {
          data: { session: recoveredSession }
        } = await supabase.auth.getSession();
        if (recoveredSession) {
          authDebug('onboarding:oauth:recoveredSessionDespiteError', { provider, step: 2 });
          await ensureProfileAfterOAuthLogin(recoveredSession);
          router.replace(postAuthDestination(recoveredSession.user));
          return;
        }
        if (!isOAuthCancelled(error)) {
          Alert.alert(t('auth.login.submit'), error.message);
        }
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert(t('auth.login.submit'), t('onboarding.social.unableComplete'));
        return;
      }

      await ensureProfileAfterOAuthLogin(session);
      authDebug('onboarding:oauth:navigateFeed:before', { provider, step: 2 });
      router.replace(postAuthDestination(session.user));
      authDebug('onboarding:oauth:navigateFeed:after', { provider, step: 2 });
    } catch (e) {
      authDebugError('onboarding:oauth:exception', e, { provider, step: 2 });
      Alert.alert(t('auth.login.submit'), t('onboarding.social.unableSocial'));
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/brand/logo-bloomi-full.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.footer}>
            <Button
              title={t('onboarding.social.apple')}
              onPress={() => void handleSocialLogin('apple')}
              variant="apple-black"
              style={styles.socialButton}
              loading={oauthLoading}
              disabled={oauthLoading}
            />
            <Button
              title={t('onboarding.social.google')}
              onPress={() => void handleSocialLogin('google')}
              variant="apple-black"
              style={styles.socialButton}
              loading={oauthLoading}
              disabled={oauthLoading}
            />
            <Button
              title={t('onboarding.social.facebook')}
              onPress={() => void handleSocialLogin('facebook')}
              variant="facebook-blue"
              style={styles.socialButton}
              disabled={oauthLoading}
            />

            <DividerOr />

            <Button
              title={t('onboarding.step2.signUpEmail')}
              onPress={() => router.push('/auth/sign-up')}
              variant="primary-green"
              style={styles.socialButton}
              disabled={oauthLoading}
            />

            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                {`${t('onboarding.step1.alreadyAccount')} `}
                <Text
                  style={styles.loginLinkButton}
                  onPress={() => router.push('/auth/login')}
                >
                  {t('auth.login.submit')}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.legalContainer}>
            <Text style={styles.legalText}>
              {`${t('onboarding.legal.prefix')} `}
              <Text
                style={styles.legalLink}
                onPress={() => openTermsOfUse(router)}
              >
                {t('common.termsOfService')}
              </Text>
              {' '}
              {`${t('onboarding.legal.andRead')} `}
              <Text style={styles.legalLink} onPress={openPrivacyPolicy}>
                {t('common.privacyPolicy')}
              </Text>
            </Text>
          </View>
        </SafeAreaView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  container: {
    flex: 1
  },
  header: {
    paddingTop: 24,
    alignItems: 'center'
  },
  logoImage: {
    width: 180,
    height: 72
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingBottom: 40
  },
  socialButton: {
    marginBottom: 12
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center'
  },
  loginLinkText: {
    ...theme.typography.body,
    color: theme.colors.appleBlack
  },
  loginLinkButton: {
    color: theme.colors.primary,
    fontWeight: '600'
  },
  legalContainer: {
    marginTop: 40,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingBottom: 30
  },
  legalText: {
    ...theme.typography.captionSm,
    color: theme.colors.textSecondary,
    textAlign: 'center'
  },
  legalLink: {
    color: theme.colors.appleBlack,
    fontWeight: '600'
  }
});
