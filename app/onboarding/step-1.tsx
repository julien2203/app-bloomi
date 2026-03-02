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
          {/* Logo "b." en haut */}
          <View style={styles.header}>
            <Text style={styles.logo}>b.</Text>
          </View>

          {/* Contenu centré */}
          <View style={styles.content}>
            {/* TODO: Ajouter le texte accroche depuis Figma */}
            <Text style={styles.headline}>
              Discover amazing second-hand finds
            </Text>
            <Text style={styles.subheadline}>
              Buy and sell pre-loved items in your community
            </Text>
          </View>

          {/* CTA en bas */}
          <View style={styles.footer}>
            <Button
              title="Sign up for Bloomi"
              onPress={() => router.push('/onboarding/step-2')}
              variant="primary-green"
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
  }
});
