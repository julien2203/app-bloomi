import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : undefined;
  const [loadingResend, setLoadingResend] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpenMailbox = () => {
    Linking.openURL('mailto:').catch(() => {
      // Pas critique si l'app mail ne s'ouvre pas, on ignore l'erreur
    });
  };

  const handleResend = async () => {
    if (!email) {
      setError('Adresse e-mail manquante.');
      return;
    }

    setLoadingResend(true);
    setError(null);
    setMessage(null);

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        setMessage("Un nouvel e-mail de confirmation vient d'être envoyé.");
      }
    } catch (e) {
      setError("Impossible de renvoyer l'e-mail pour le moment.");
    } finally {
      setLoadingResend(false);
    }
  };

  const displayedEmail = email ?? 'your email address';

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Verify your email</Text>
          <TouchableOpacity
            onPress={async () => {
              try {
                await supabase.auth.signOut();
              } finally {
                router.replace('/onboarding/splash');
              }
            }}
            style={styles.logoutButton}
            hitSlop={HIT_SLOP_COMFORTABLE}
          >
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerSeparator} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.mainContent}>
            {/* Illustration */}
            <View style={styles.illustrationContainer}>
              <Image
                source={require('../../assets/onboarding/illustration-email.png')}
                style={styles.illustrationImage}
                resizeMode="contain"
              />
            </View>

            {/* Bloc texte */}
            <View style={styles.textBlock}>
              <Text style={styles.title}>
                Verify your email to keep your account secure
              </Text>
              <Text style={styles.subtitle}>
                Verifying your email address helps you to safely recover your password, retrieve and
                protect your account, and receive secure messages from us.
              </Text>
            </View>

            {/* Bouton principal */}
            <Button
              title="Ouvrir ma boîte mail"
              onPress={handleOpenMailbox}
              variant="primary-green"
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />

            {/* Lien Learn more */}
            <TouchableOpacity
              onPress={() => {
                // Conserver la logique existante si elle est ajoutée plus tard
              }}
              style={styles.learnMoreContainer}
            >
              <Text style={styles.learnMoreText}>Learn more</Text>
            </TouchableOpacity>

            {/* Lien renvoi email + messages */}
            <TouchableOpacity onPress={handleResend} style={styles.resendLink}>
              <Text style={styles.resendText}>
                Vous n'avez pas reçu notre e-mail ?{' '}
                <Text style={styles.resendTextUnderline}>Renvoyer le lien</Text>
              </Text>
            </TouchableOpacity>

            {message && (
              <Text style={styles.infoMessage}>
                {message}
              </Text>
            )}
            {error && (
              <Text style={styles.errorMessage}>
                {error}
              </Text>
            )}

            {/* Legal en bas */}
            <View style={styles.legalContainer}>
              <Text style={styles.legalText}>
                By continuing, you agree to Bloomi&apos;s{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://bloomi.app/terms')}
                >
                  Terms of Service
                </Text>{' '}
                and acknowledge you&apos;ve read our{' '}
                <Text
                  style={styles.legalLink}
                  onPress={() => Linking.openURL('https://bloomi.app/privacy')}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </View>
        </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12
  },
  headerTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary,
    fontSize: 16
  },
  logoutButton: {
    paddingVertical: 4
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '400',
    color: theme.colors.textPrimary
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  mainContent: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 0
  },
  illustrationContainer: {
    alignSelf: 'center',
    marginTop: 48,
    marginBottom: 40,
    width: 220,
    height: 220
  },
  illustrationImage: {
    width: '100%',
    height: '100%'
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 16
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#888888',
    textAlign: 'center',
    lineHeight: 21
  },
  textBlock: {
    paddingHorizontal: 32
  },
  primaryButton: {
    marginTop: 32,
    marginHorizontal: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#CCFF00'
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  },
  learnMoreContainer: {
    marginTop: 16,
    alignItems: 'center'
  },
  learnMoreText: {
    fontSize: 14,
    color: theme.colors.textPrimary,
    textDecorationLine: 'underline'
  },
  resendLink: {
    alignItems: 'center',
    paddingVertical: 12
  },
  resendText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center'
  },
  resendTextUnderline: {
    textDecorationLine: 'underline',
    color: theme.colors.primary,
    fontFamily: theme.fontFamily.semiBold
  },
  infoMessage: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: 8
  },
  errorMessage: {
    ...theme.typography.caption,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8
  },
  legalContainer: {
    marginTop: 'auto',
    paddingHorizontal: 24,
    marginBottom: 24
  },
  legalText: {
    fontSize: 12,
    color: '#AAAAAA',
    textAlign: 'center',
    lineHeight: 18
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: '#AAAAAA'
  }
});

