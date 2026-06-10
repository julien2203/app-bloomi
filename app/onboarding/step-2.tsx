/**
 * Onboarding Step 2
 * Background photo full-screen + logo "b." + boutons social (Apple/Google/Facebook) + "or" + CTA vert
 */

import React, { useState } from 'react';
import { View, Text, ImageBackground, StyleSheet, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
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

export default function OnboardingStep2() {
  const { t } = useTranslation();
  const router = useRouter();
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSocialLogin = async (provider: 'apple' | 'google' | 'facebook') => {
    if (provider === 'facebook') {
      Alert.alert(t('onboarding.social.facebook'), t('onboarding.social.facebookSoon'));
      return;
    }

    setOauthLoading(true);

    try {
      const oauthProvider = provider as OAuthProvider;
      const { error } = await signInWithOAuthProvider(oauthProvider);

      if (error) {
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
      router.replace('/tabs/feed');
    } catch {
      Alert.alert(t('auth.login.submit'), t('onboarding.social.unableSocial'));
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/onboarding/bg2.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.container}>
          {/* Logo Bloomi centré en haut */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/brand/logo-b.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

        
          {/* Boutons en bas */}
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
              variant="google-white"
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

            <DividerOr variant="light" />

            <Button
              title={t('onboarding.step2.signUpEmail')}
              onPress={() => router.push('/auth/sign-up')}
              variant="primary-green"
              style={styles.socialButton}
              disabled={oauthLoading}
            />

            {/* Ancien bouton vers /auth/sign-in retiré car écran supprimé */}

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
              <Text style={styles.legalLink}>{t('common.termsOfService')}</Text>
              {' '}
              {`${t('onboarding.legal.andRead')} `}
              <Text style={styles.legalLink}>{t('common.privacyPolicy')}</Text>
            </Text>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%'
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
    height: 180
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  headline: {
    ...theme.typography.h1,
    color: theme.colors.googleWhite,
    marginBottom: 16
  },
  subheadline: {
    ...theme.typography.body,
    color: theme.colors.googleWhite,
    opacity: 0.9
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
  phoneButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.googleWhite,
    backgroundColor: 'transparent'
  },
  phoneButtonText: {
    color: theme.colors.googleWhite
  },
  loginLink: {
    marginTop: 16,
    alignItems: 'center'
  },
  loginLinkText: {
    ...theme.typography.body,
    color: theme.colors.googleWhite
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
    color: theme.colors.googleWhite,
    textAlign: 'center',
    opacity: 0.9
  },
  legalLink: {
    color: '#C3EA4F',
    fontWeight: '600'
  }
});
