/**
 * Écran Verify Email (Simple)
 * Input code + bouton "Get my verification code" + lien "Didn't receive our email?"
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';

export default function VerifyEmailSimpleScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    // TODO: Implémenter la vérification du code
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.replace('/tabs/feed');
    }, 1000);
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={styles.title}>Verify your email</Text>
              <Text style={styles.subtitle}>
                Enter the verification code sent to your email address.
              </Text>

              <TextField
                label="Verification code"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.codeField}
              />

              <Button
                title="Verify"
                onPress={handleVerify}
                variant="primary-green"
                loading={loading}
                disabled={code.length !== 6}
                style={styles.button}
              />

              <TouchableOpacity
                onPress={() => {
                  // TODO: Renvoyer le code
                }}
                style={styles.resendLink}
              >
                <Text style={styles.resendLinkText}>
                  Didn't receive our email?{' '}
                  <Text style={styles.resendLinkButton}>Resend code</Text>
                </Text>
              </TouchableOpacity>
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
    marginBottom: 16
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: 32
  },
  codeField: {
    marginBottom: 24
  },
  button: {
    marginTop: 8,
    marginBottom: 24
  },
  resendLink: {
    alignItems: 'center'
  },
  resendLinkText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  resendLinkButton: {
    color: theme.colors.primary,
    fontWeight: '600'
  }
});
