/**
 * Écran Sign Up
 * Full name, username, email, password (toggle eye), choix "Selling / Buying / Both" (segmented),
 * checkbox mailing, checkbox T&C, bouton "Sign up"
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { Segmented } from '../../components/ui/Segmented';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('both');
  const [mailingChecked, setMailingChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userTypeOptions = [
    { label: 'Selling', value: 'selling' },
    { label: 'Buying', value: 'buying' },
    { label: 'Both', value: 'both' }
  ];

  const handleSignUp = async () => {
    if (!termsChecked || !fullName || !username || !email || !password) {
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `bloomi://auth/callback?email=${encodeURIComponent(email)}`,
          data: {
            full_name: fullName,
            username,
            user_type: userType,
            marketing_optin: mailingChecked
          }
        }
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // Supabase envoie un email de vérification si configuré dans le dashboard.
      // On redirige vers l'écran qui explique à l'utilisateur de vérifier sa boîte mail.
      router.push({
        pathname: '/auth/verify-email',
        params: { email }
      });
    } catch (e) {
      setError('Une erreur est survenue lors de l’inscription. Merci de réessayer.');
      setLoading(false);
    }
  };

  const canSubmit = fullName && username && email && password && termsChecked;

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
              <Text style={styles.title}>Sign up</Text>

              <TextField
                label="Full name"
                value={fullName}
                onChangeText={setFullName}
                placeholder="John Doe"
                autoCapitalize="words"
              />

              <TextField
                label="Username"
                value={username}
                onChangeText={setUsername}
                placeholder="johndoe"
                autoCapitalize="none"
                autoComplete="username"
              />

              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />

              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Create a password"
                secureTextEntry
                showToggle
              />

              <View style={styles.segmentedContainer}>
                <Text style={styles.segmentedLabel}>I'm interested in:</Text>
                <Segmented
                  options={userTypeOptions}
                  value={userType}
                  onValueChange={setUserType}
                />
              </View>

              <Checkbox
                checked={mailingChecked}
                onPress={() => setMailingChecked(!mailingChecked)}
                label="I want to receive marketing emails and updates"
              />

              <Checkbox
                checked={termsChecked}
                onPress={() => setTermsChecked(!termsChecked)}
                labelComponent={
                  <Text style={styles.checkboxLabel}>
                    I agree to the{' '}
                    <Text
                      style={styles.link}
                      onPress={() => Linking.openURL('https://bloomi.app/terms')}
                    >
                      Terms & Conditions
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={styles.link}
                      onPress={() => Linking.openURL('https://bloomi.app/privacy')}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                }
              />

              {error ? (
                <Text
                  style={{
                    ...theme.typography.body,
                    color: '#ef4444',
                    marginTop: 8,
                    marginBottom: 8
                  }}
                >
                  {error}
                </Text>
              ) : null}

              <Button
                title="Sign up"
                onPress={handleSignUp}
                variant="primary-green"
                disabled={!canSubmit || loading}
                loading={loading}
                style={styles.signupButton}
              />

              <View style={styles.loginLink}>
                <Text style={styles.loginLinkText}>
                  Already have an account?{' '}
                  <Text
                    style={styles.loginLinkButton}
                    onPress={() => router.push('/auth/login')}
                  >
                    Log in
                  </Text>
                </Text>
              </View>
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
    marginBottom: 32
  },
  segmentedContainer: {
    marginBottom: 24
  },
  segmentedLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 12,
    fontWeight: '500'
  },
  checkboxLabel: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  },
  link: {
    color: theme.colors.primary,
    fontWeight: '600'
  },
  signupButton: {
    marginTop: 8,
    marginBottom: 24
  },
  loginLink: {
    alignItems: 'center'
  },
  loginLinkText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  loginLinkButton: {
    color: theme.colors.primary,
    fontWeight: '600'
  }
});
