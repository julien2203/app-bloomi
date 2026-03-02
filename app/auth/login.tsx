/**
 * Écran Login
 * Email + password + "Forgot password?" + bouton "Log in" + séparateur "or" + social buttons + lien "Sign up"
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { DividerOr } from '../../components/ui/DividerOr';
import { theme } from '../../lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    // TODO: Implémenter la logique de connexion
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // router.replace('/tabs/feed');
    }, 1000);
  };

  const handleSocialLogin = (provider: 'apple' | 'google' | 'facebook') => {
    // TODO: Implémenter la logique de connexion sociale
    console.log(`Login with ${provider}`);
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
              <Text style={styles.title}>Log in</Text>

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
                placeholder="Enter your password"
                secureTextEntry
                showToggle
              />

              <TouchableOpacity
                onPress={() => router.push('/auth/forgot-password')}
                style={styles.forgotLink}
              >
                <Text style={styles.forgotLinkText}>Forgot password?</Text>
              </TouchableOpacity>

              <Button
                title="Log in"
                onPress={handleLogin}
                variant="primary-green"
                loading={loading}
                style={styles.loginButton}
              />

              <DividerOr />

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

              <View style={styles.signupLink}>
                <Text style={styles.signupLinkText}>
                  Don't have an account?{' '}
                  <Text
                    style={styles.signupLinkButton}
                    onPress={() => router.push('/auth/sign-up')}
                  >
                    Sign up
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
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 24
  },
  forgotLinkText: {
    ...theme.typography.body,
    color: theme.colors.primary
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 8
  },
  socialButton: {
    marginBottom: 12
  },
  signupLink: {
    marginTop: 24,
    alignItems: 'center'
  },
  signupLinkText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  signupLinkButton: {
    color: theme.colors.primary,
    fontWeight: '600'
  }
});
