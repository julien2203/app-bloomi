/**
 * Onboarding Step 1
 * Background photo full-screen + logo "b." en haut + texte accroche + CTA "Sign up for Bloomi"
 */

import React from 'react';
import { View, Text, ImageBackground, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';

export default function OnboardingStep1() {
  const router = useRouter();

  return (
    <>
      <StatusBar style="light" />
      <ImageBackground
        source={require('../../assets/onboarding/bg1.jpg')}
        style={styles.background}
        resizeMode="cover"
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/brand/logo-bloomi-white.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.main}>
            <Text style={styles.headline}>
              Sell pre-loved clothes completely free
            </Text>

            <Button
              title="Sign up for Bloomi"
              onPress={() => router.push('/onboarding/step-2')}
              variant="primary-green"
              style={styles.primaryButton}
            />

            <Text style={styles.loginText}>
              Already have an account?{' '}
              <Text
                style={styles.loginLink}
                onPress={() => router.push('/auth/login')}
              >
                Log in
              </Text>
            </Text>
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
  main: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: theme.spacing.horizontalPadding,
    alignItems: 'center'
  },
  headline: {
    ...theme.typography.h1,
    color: theme.colors.googleWhite,
    textAlign: 'center',
    fontSize: 32
  },
  primaryButton: {
    marginTop: 60,
    alignSelf: 'stretch'
  },
  loginText: {
    marginTop: 40,
    ...theme.typography.body,
    color: theme.colors.googleWhite,
    textAlign: 'center'
  },
  loginLink: {
    color: theme.colors.googleWhite,
    fontWeight: '600',
    textDecorationLine: 'underline'
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
