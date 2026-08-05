/**
 * Écran Login
 * Email + password + "Forgot password?" + bouton "Log in" + séparateur "or" + social buttons + lien "Sign up"
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { DividerOr } from '../../components/ui/DividerOr';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { ensureProfileExists } from '../../lib/profile';
import {
  ensureProfileAfterOAuthLogin,
  isOAuthCancelled,
  signInWithOAuthProvider,
  type OAuthProvider
} from '../../lib/socialAuth';
import { useAuthStore } from '../../stores/authStore';
import { authDebug, authDebugError } from '../../lib/authDebugLog';
import { postAuthDestination } from '../../lib/auth/needsPhoneVerification';

export default function LoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const enterGuestMode = useAuthStore((s) => s.enterGuestMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      return;
    }

    setError(null);
    setLoading(true);
    authDebug('login:password:start', { email: email.trim().toLowerCase() });

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        authDebugError('login:password:signInFailed', signInError);
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        authDebug('login:password:noSession');
        setError(t('auth.login.unableSignIn'));
        setLoading(false);
        return;
      }

      const userId = data.session.user.id;
      const markerKey = `profile_ensured_after_login:${userId}`;
      authDebug('login:password:sessionOk', {
        userId,
        hasPhone: Boolean(data.session.user.phone),
        emailConfirmed: Boolean(data.session.user.email_confirmed_at)
      });

      // S'assurer qu'un profil existe pour cet utilisateur (nécessaire pour listings.seller_id -> profiles.id)
      // Marqueur utilisé pour éviter un doublon du chargement profil dans `AuthGate` (app/_layout.tsx).
      await AsyncStorage.setItem(markerKey, String(Date.now()));
      authDebug('login:password:ensureProfile:start');
      const profile = await ensureProfileExists(data.session, {
        // En attendant la vérification SMS réelle, on utilise un numéro de test
        phone: (data.session.user.phone as string | null | undefined) ?? '+41791234567',
        country: 'CH'
      });
      authDebug('login:password:ensureProfile:done', { profileId: profile?.id ?? null });

      authDebug('login:password:navigateFeed:before');
      router.replace(postAuthDestination(data.session.user));
      authDebug('login:password:navigateFeed:after');
    } catch (e) {
      authDebugError('login:password:exception', e);
      setError(t('auth.login.somethingWrong'));
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'apple' | 'google' | 'facebook') => {
    if (provider === 'facebook') {
      setError(t('auth.login.facebookUnavailable'));
      return;
    }
    if (oauthLoading) return;

    setError(null);
    setOauthLoading(true);
    authDebug('login:oauth:start', { provider });

    try {
      const oauthProvider = provider as OAuthProvider;
      const { error: oauthError } = await signInWithOAuthProvider(oauthProvider);

      if (oauthError) {
        const {
          data: { session: recoveredSession }
        } = await supabase.auth.getSession();
        if (recoveredSession) {
          authDebug('login:oauth:recoveredSessionDespiteError', { provider });
          await ensureProfileAfterOAuthLogin(recoveredSession);
          router.replace(postAuthDestination(recoveredSession.user));
          return;
        }
        if (!isOAuthCancelled(oauthError)) {
          authDebugError('login:oauth:failed', oauthError, { provider });
          setError(oauthError.message);
        } else {
          authDebug('login:oauth:cancelled', { provider });
        }
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) {
        authDebug('login:oauth:noSession', { provider });
        setError(t('onboarding.social.unableComplete'));
        return;
      }

      authDebug('login:oauth:sessionOk', {
        provider,
        userId: session.user.id,
        hasPhone: Boolean(session.user.phone)
      });
      await ensureProfileAfterOAuthLogin(session);
      authDebug('login:oauth:navigateFeed:before', { provider });
      router.replace(postAuthDestination(session.user));
      authDebug('login:oauth:navigateFeed:after', { provider });
    } catch (e) {
      authDebugError('login:oauth:exception', e, { provider });
      setError(t('onboarding.social.unableSocial'));
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={styles.title}>{t('auth.login.title')}</Text>

              <TextField
                label={t('auth.login.email')}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.login.emailPlaceholder')}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <TextField
                label={t('auth.login.password')}
                value={password}
                onChangeText={setPassword}
                placeholder={t('auth.login.passwordPlaceholder')}
                secureTextEntry
                showToggle
              />

              <TouchableOpacity
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotLinkText}>{t('auth.login.forgotPassword')}</Text>
              </TouchableOpacity>

              {error ? (
                <Text
                  style={{
                    ...theme.typography.body,
                    color: '#ef4444',
                    marginTop: 8,
                    marginBottom: 8
                  }}
                >
                  {error}
                </Text>
              ) : null}

              <Button
                title={t('auth.login.submit')}
                onPress={handleLogin}
                variant="primary-green"
                loading={loading}
                style={styles.loginButton}
                disabled={loading || !email || !password}
              />

              <DividerOr />

              <Button
                title={t('auth.login.continueApple')}
                onPress={() => void handleSocialLogin('apple')}
                variant="apple-black"
                style={styles.socialButton}
                loading={oauthLoading}
                disabled={oauthLoading || loading}
              />
              <Button
                title={t('auth.login.continueGoogle')}
                onPress={() => void handleSocialLogin('google')}
                variant="google-white"
                style={styles.socialButton}
                loading={oauthLoading}
                disabled={oauthLoading || loading}
              />
              <Button
                title={t('auth.login.continueFacebook')}
                onPress={() => void handleSocialLogin('facebook')}
                variant="facebook-blue"
                style={styles.socialButton}
                disabled={oauthLoading || loading}
              />

              <View style={styles.signupLink}>
                <Text style={styles.signupLinkText}>
                  {`${t('auth.login.noAccount')} `}
                  <Text
                    style={styles.signupLinkButton}
                    onPress={() => router.push('/auth/sign-up')}
                  >
                    {t('auth.login.signUpLink')}
                  </Text>
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  void (async () => {
                    try {
                      authDebug('guest:button:pressed', { from: 'login' });
                      await enterGuestMode();
                      authDebug('guest:navigateFeed:before', { from: 'login' });
                      router.replace('/tabs/feed');
                      authDebug('guest:navigateFeed:after', { from: 'login' });
                    } catch (e) {
                      authDebugError('guest:exception', e, { from: 'login' });
                    }
                  })();
                }}
                style={styles.guestLink}
              >
                <Text style={styles.guestLinkText}>{t('auth.login.continueGuest')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.backgroundWhite
  },
  header: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 48,
    paddingBottom: 32
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary,
    marginBottom: 32
  },
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 24
  },
  forgotLinkText: {
    ...theme.typography.body,
    color: theme.colors.primary
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 8
  },
  socialButton: {
    marginBottom: 12
  },
  signupLink: {
    marginTop: 24,
    alignItems: 'center'
  },
  signupLinkText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  signupLinkButton: {
    color: theme.colors.primary,
    fontWeight: '600'
  },
  guestLink: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8
  },
  guestLinkText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textDecorationLine: 'underline'
  }
});
