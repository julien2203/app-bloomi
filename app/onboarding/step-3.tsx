/**
 * Onboarding Step 3
 * Idem step-2 mais avec autre background (noir et blanc)
 */

import React, { useState } from 'react';
import { View, Text, ImageBackground, StyleSheet, Image, Alert } from 'react-native';
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

export default function OnboardingStep3() {
  const router = useRouter();
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleSocialLogin = async (provider: 'apple' | 'google' | 'facebook') => {
    if (provider === 'facebook') {
      Alert.alert('Facebook', 'Facebook sign-in is coming soon.');
      return;
    }

    setOauthLoading(true);

    try {
      const oauthProvider = provider as OAuthProvider;
      const { error } = await signInWithOAuthProvider(oauthProvider);

      if (error) {
        if (!isOAuthCancelled(error)) {
          Alert.alert('Sign in', error.message);
        }
        return;
      }

      const {
        data: { session }
      } = await supabase.auth.getSession();
      if (!session) {
        Alert.alert('Sign in', 'Unable to complete sign-in. Please try again.');
        return;
      }

      await ensureProfileAfterOAuthLogin(session);
      router.replace('/tabs/feed');
    } catch {
      Alert.alert('Sign in', 'Something went wrong during social sign-in.');
    } finally {
      setOauthLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/onboarding/bg3.jpg')}
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

          {/* Contenu centré */}
          <View style={styles.content}>
            {/* TODO: Ajouter le texte depuis Figma */}
            <Text style={styles.headline}>
              Your marketplace awaits
            </Text>
            <Text style={styles.subheadline}>
              Connect with your community
            </Text>
          </View>

          {/* Boutons en bas */}
          <View style={styles.footer}>
            <Button
              title="Continue with Apple"
              onPress={() => void handleSocialLogin('apple')}
              variant="apple-black"
              style={styles.socialButton}
              loading={oauthLoading}
              disabled={oauthLoading}
            />
            <Button
              title="Continue with Google"
              onPress={() => void handleSocialLogin('google')}
              variant="google-white"
              style={styles.socialButton}
              loading={oauthLoading}
              disabled={oauthLoading}
            />
            <Button
              title="Continue with Facebook"
              onPress={() => void handleSocialLogin('facebook')}
              variant="facebook-blue"
              style={styles.socialButton}
              disabled={oauthLoading}
            />

            <DividerOr variant="light" />

            <Button
              title="Sign up to Bloomi"
              onPress={() => router.push('/auth/sign-up')}
              variant="primary-green"
              disabled={oauthLoading}
            />

            <View style={styles.loginLink}>
              <Text style={styles.loginLinkText}>
                Do you already have an account?{' '}
                <Text
                  style={styles.loginLinkButton}
                  onPress={() => router.push('/auth/login')}
                >
                  Log in.
                </Text>
              </Text>
            </View>
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
    width: 96,
    height: 96
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
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingBottom: 32
  },
  socialButton: {
    marginBottom: 12
  },
  loginLink: {
    marginTop: 24,
    alignItems: 'center'
  },
  loginLinkText: {
    ...theme.typography.body,
    color: theme.colors.googleWhite
  },
  loginLinkButton: {
    color: theme.colors.primary,
    fontWeight: '600'
  }
});
