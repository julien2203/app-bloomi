/**
 * Onboarding Step 2
 * Background photo full-screen + logo "b." + boutons social (Apple/Google/Facebook) + "or" + CTA vert
 */

import React from 'react';
import { View, Text, ImageBackground, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { DividerOr } from '../../components/ui/DividerOr';
import { theme } from '../../lib/theme';

export default function OnboardingStep2() {
  const router = useRouter();

  const handleSocialLogin = (provider: 'apple' | 'google' | 'facebook') => {
    // TODO: Implémenter la logique de connexion sociale
    console.log(`Login with ${provider}`);
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
              title="Continue with Apple"
              onPress={() => handleSocialLogin('apple')}
              variant="apple-black"
              style={styles.socialButton}
            />
            <Button
              title="Continue with Google"
              onPress={() => handleSocialLogin('google')}
              variant="google-white"
              style={styles.socialButton}
            />
            <Button
              title="Continue with Facebook"
              onPress={() => handleSocialLogin('facebook')}
              variant="facebook-blue"
              style={styles.socialButton}
            />

            <DividerOr variant="light" />

            <Button
              title="Sign up with email"
              onPress={() => router.push('/auth/sign-up')}
              variant="primary-green"
              style={styles.socialButton}
            />

            {/* Ancien bouton vers /auth/sign-in retiré car écran supprimé */}

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

          <View style={styles.legalContainer}>
            <Text style={styles.legalText}>
              By continuing, you agree to Thrivi&apos;s{' '}
              <Text style={styles.legalLink}>Terms of Service</Text>
              {' '}and acknowledge you&apos;ve read our{' '}
              <Text style={styles.legalLink}>Privacy Policy</Text>
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
