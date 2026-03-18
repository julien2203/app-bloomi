/**
 * Écran Splash - Bloomi
 * Fond vert #C3EA4F, logo centré, "SECOND HAND" sous le logo
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../../lib/theme';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers le premier écran d'onboarding après 2 secondes
    const timer = setTimeout(() => {
      router.replace('/onboarding/step-1');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Image
              source={require('../../assets/brand/logo-bloomi.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.primary
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  logoContainer: {
    marginBottom: 16
  },
  logoImage: {
    width: 280,
    height: 280
  }
});
