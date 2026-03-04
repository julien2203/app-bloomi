/**
 * Onboarding Step 2
 * Background photo full-screen + logo "b." + boutons social (Apple/Google/Facebook) + "or" + CTA vert
 */

import React from 'react';
import { View, Text, ImageBackground, StyleSheet } from 'react-native';
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
          {/* Logo "b." en haut */}
          <View style={styles.header}>
            <Text style={styles.logo}>b.</Text>
          </View>

          {/* Contenu centré */}
          <View style={styles.content}>
            {/* TODO: Ajouter le texte depuis Figma */}
            <Text style={styles.headline}>
              Join thousands of users
            </Text>
            <Text style={styles.subheadline}>
              Start buying and selling today
            </Text>
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

            <DividerOr />

            <Button
              title="Sign up with email"
              onPress={() => router.push('/auth/sign-up')}
              variant="primary-green"
              style={styles.socialButton}
            />

            <Button
              title="Se connecter avec téléphone"
              onPress={() => router.push('/auth/sign-in')}
              variant="link"
              style={styles.phoneButton}
              textStyle={styles.phoneButtonText}
            />
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
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 16
  },
  logo: {
    fontSize: 32,
    fontFamily: theme.fontFamily.bold,
    color: theme.colors.googleWhite
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
  phoneButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.googleWhite,
    backgroundColor: 'transparent'
  },
  phoneButtonText: {
    color: theme.colors.googleWhite
  }
});
