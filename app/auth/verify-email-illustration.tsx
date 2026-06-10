/**
 * Écran Verify Email (Illustration)
 * Gros titre + texte + bouton "Get my verification code" + "Learn more" + footer Terms/Privacy + "Log out" en header
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

export default function VerifyEmailIllustrationScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const handleLogout = () => {
    // TODO: Implémenter la déconnexion
    router.replace('/onboarding/splash');
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        {/* Header avec Log out */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>{t('auth.verifyEmailIllustration.logOut')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* TODO: Ajouter illustration depuis Figma */}
            <View style={styles.illustration}>
              <Ionicons name="mail-outline" size={80} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>{t('auth.verifyEmailIllustration.title')}</Text>
            <Text style={styles.message}>{t('auth.checkEmail.messageGeneric')}</Text>

            <Button
              title={t('auth.verifyEmailIllustration.getCode')}
              onPress={() => router.push('/auth/verify-email-simple')}
              variant="primary-green"
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() => {
                // TODO: Ouvrir page "Learn more"
              }}
              style={styles.learnMore}
            >
              <Text style={styles.learnMoreText}>{t('common.learnMore')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            onPress={() => {
              // TODO: Ouvrir Terms
            }}
          >
            <Text style={styles.footerLink}>{t('auth.verifyEmailIllustration.terms')}</Text>
          </TouchableOpacity>
          <Text style={styles.footerSeparator}> • </Text>
          <TouchableOpacity
            onPress={() => {
              // TODO: Ouvrir Privacy
            }}
          >
            <Text style={styles.footerLink}>{t('auth.verifyEmailIllustration.privacy')}</Text>
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 8,
    alignItems: 'flex-end'
  },
  logoutButton: {
    paddingVertical: 8
  },
  logoutText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 48,
    alignItems: 'center'
  },
  illustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24
  },
  button: {
    marginBottom: 16
  },
  learnMore: {
    paddingVertical: 8
  },
  learnMoreText: {
    ...theme.typography.body,
    color: theme.colors.primary
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  footerLink: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary
  },
  footerSeparator: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary
  }
});
