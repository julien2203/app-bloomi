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

export default function LoginScreen() {
  const router = useRouter();
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

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setError('Unable to sign in. Please try again.');
        setLoading(false);
        return;
      }

      const userId = data.session.user.id;
      const markerKey = `profile_ensured_after_login:${userId}`;

      // S'assurer qu'un profil existe pour cet utilisateur (nécessaire pour listings.seller_id -> profiles.id)
      // Marqueur utilisé pour éviter un doublon du chargement profil dans `AuthGate` (app/_layout.tsx).
      await AsyncStorage.setItem(markerKey, String(Date.now()));
      await ensureProfileExists(data.session, {
        // En attendant la vérification SMS réelle, on utilise un numéro de test
        phone: (data.session.user.phone as string | null | undefined) ?? '+41791234567',
        country: 'CH'
      });

      // Connexion réussie : on redirige vers le feed
      router.replace('/tabs/feed');
    } catch (e) {
      setError('Something went wrong during sign-in.');
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'apple' | 'google' | 'facebook') => {
    if (provider === 'facebook') {
      setError('Facebook sign-in is not available yet.');
      return;
    }

    setError(null);
    setOauthLoading(true);

    try {
      const oauthProvider = provider as OAuthProvider;
      const { error: oauthError } = await signInWithOAuthProvider(oauthProvider);

      if (oauthError) {
        if (!isOAuthCancelled(oauthError)) {
          setError(oauthError.message);
        }
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) {
        setError('Unable to complete sign-in. Please try again.');
        return;
      }

      await ensureProfileAfterOAuthLogin(session);
      router.replace('/tabs/feed');
    } catch {
      setError('Something went wrong during social sign-in.');
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
              <Text style={styles.title}>Log in</Text>

              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                secureTextEntry
                showToggle
              />

              <TouchableOpacity
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
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
                title="Log in"
                onPress={handleLogin}
                variant="primary-green"
                loading={loading}
                style={styles.loginButton}
                disabled={loading || !email || !password}
              />

              <DividerOr />

              <Button
                title="Continue with Apple"
                onPress={() => void handleSocialLogin('apple')}
                variant="apple-black"
                style={styles.socialButton}
                loading={oauthLoading}
                disabled={oauthLoading || loading}
              />
              <Button
                title="Continue with Google"
                onPress={() => void handleSocialLogin('google')}
                variant="google-white"
                style={styles.socialButton}
                loading={oauthLoading}
                disabled={oauthLoading || loading}
              />
              <Button
                title="Continue with Facebook"
                onPress={() => void handleSocialLogin('facebook')}
                variant="facebook-blue"
                style={styles.socialButton}
                disabled={oauthLoading || loading}
              />

              <View style={styles.signupLink}>
                <Text style={styles.signupLinkText}>
                  Don't have an account?{' '}
                  <Text
                    style={styles.signupLinkButton}
                    onPress={() => router.push('/auth/sign-up')}
                  >
                    Sign up
                  </Text>
                </Text>
              </View>
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
  }
});
