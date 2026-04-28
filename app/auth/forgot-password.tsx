/**
 * Écran Forgot Password
 * Email + bouton "Send reset link"
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendResetLink = async () => {
    if (!email || loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `bloomi://auth/callback?type=recovery&email=${encodeURIComponent(email.trim())}`
      });
      if (error) throw error;
      setLoading(false);
      setSent(true);
    } catch (error) {
      setLoading(false);
      console.warn('Failed to send reset password email:', error);
    }
  };

  if (sent) {
    return (
      <>
        <StatusBar style="dark" />
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Check your email</Text>
            <Text style={styles.message}>
              We've sent a password reset link to {email}
            </Text>
            <Button
              title="Back to login"
              onPress={() => router.push('/auth/login')}
              variant="primary-green"
              style={styles.button}
            />
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
        </View>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              <Text style={styles.title}>Forgot password?</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you a link to reset your password.
              </Text>

              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={styles.emailField}
              />

              <Button
                title="Send reset link"
                onPress={handleSendResetLink}
                variant="primary-green"
                loading={loading}
                disabled={!email}
                style={styles.button}
              />
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
  header: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center'
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
  emailField: {
    marginBottom: 24
  },
  button: {
    marginTop: 8
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginBottom: 32,
    textAlign: 'center'
  }
});
