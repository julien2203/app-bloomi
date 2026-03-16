import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';

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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vérifiez votre e-mail.</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Illustration */}
            <View style={styles.illustration}>
              <Ionicons name="mail-outline" size={64} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>
              Vérifiez votre e-mail pour sécuriser votre compte
            </Text>
            <Text style={styles.subtitle}>
              Un lien de confirmation a été envoyé à{' '}
              <Text style={styles.subtitleEmail}>{displayedEmail}</Text>. Cliquez dessus pour
              activer votre compte.
            </Text>

            <Button
              title="Ouvrir ma boîte mail"
              onPress={handleOpenMailbox}
              variant="primary-green"
              style={styles.primaryButton}
            />

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
          </View>

          <View style={styles.legalContainer}>
            <Text style={styles.legalText}>
              En continuant, vous acceptez les Conditions d'utilisation de Bloomi et
              reconnaissez avoir lu notre Politique de confidentialité.
            </Text>
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
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 8,
    paddingBottom: 8
  },
  backButton: {
    padding: 4
  },
  headerTitle: {
    ...theme.typography.body,
    fontFamily: theme.fontFamily.semiBold,
    color: theme.colors.textPrimary
  },
  headerSpacer: {
    width: 24
  },
  scrollContent: {
    flexGrow: 1
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 32
  },
  illustration: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: `${theme.colors.primary}20`,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 24
  },
  title: {
    ...theme.typography.h1,
    fontSize: 22,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    marginBottom: 12
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  subtitleEmail: {
    color: theme.colors.textPrimary,
    fontFamily: theme.fontFamily.semiBold
  },
  primaryButton: {
    marginBottom: 16
  },
  resendLink: {
    alignItems: 'center',
    paddingVertical: 8
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
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingVertical: 24
  },
  legalText: {
    ...theme.typography.caption,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18
  }
});

