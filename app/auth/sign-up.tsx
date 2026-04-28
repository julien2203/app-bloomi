/**
 * Écran Sign Up
 * Full name, username, email, password (toggle eye), choix "Selling / Buying / Both" (segmented),
 * checkbox mailing, checkbox T&C, bouton "Sign up"
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button } from '../../components/ui/Button';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import { AppIcon } from '../../components/ui/AppIcon';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userType, setUserType] = useState('both');
  const [mailingChecked, setMailingChecked] = useState(false);
  const [termsChecked, setTermsChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      // On redirige d'abord vers l'écran de type de vendeur avant la vérification email.
      router.push({
        pathname: '/auth/seller-type',
        params: { email }
      });
    } catch (e) {
      setError('Something went wrong during sign-up. Please try again.');
      setLoading(false);
    }
  };

  const canSubmit = fullName && username && email && password && termsChecked;

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <HeaderBackButton onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Sign up</Text>
          {/* espace pour équilibrer le header */}
          <View style={{ width: 20 }} />
        </View>
        <View style={styles.headerSeparator} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.content}>
              {/* Full name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full name</Text>
                <View style={styles.fieldInputWrapper}>
                  <TextInput
                    style={styles.fieldInput}
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                    placeholder=""
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
              </View>

              {/* Username */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Username</Text>
                <View style={styles.fieldInputWrapper}>
                  <TextInput
                    style={styles.fieldInput}
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    autoComplete="username"
                    placeholder=""
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.fieldInputWrapper}>
                  <TextInput
                    style={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder=""
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                </View>
              </View>

              {/* Password */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Password</Text>
                <View style={styles.fieldInputWrapper}>
                  <TextInput
                    style={styles.fieldInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    placeholder=""
                    placeholderTextColor={theme.colors.textSecondary}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((prev) => !prev)}
                    activeOpacity={0.7}
                  >
                  <AppIcon
                    name={showPassword ? 'eyeOutline' : 'eyeClosedOutline'}
                    size={20}
                    color={theme.colors.textPrimary}
                  />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Interest pills */}
              <View style={styles.interestSection}>
                <Text style={styles.interestLabel}>What are you more interest in?</Text>
                <View style={styles.interestPillsRow}>
                  {userTypeOptions.map((option) => {
                    const isActive = userType === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.pill,
                          isActive ? styles.pillActive : styles.pillInactive
                        ]}
                        activeOpacity={0.8}
                        onPress={() => setUserType(option.value)}
                      >
                        <Text style={styles.pillText}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Checkboxes */}
              <View style={styles.checkboxSection}>
                {/* Row 1 */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.8}
                  onPress={() => setMailingChecked((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      mailingChecked && styles.checkboxBoxChecked
                    ]}
                  >
                    {mailingChecked && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>
                    I'd like to receive personalized offers and be the first to know about the
                    latest Bloomi update via email.
                  </Text>
                </TouchableOpacity>

                {/* Row 2 */}
                <TouchableOpacity
                  style={styles.checkboxRow}
                  activeOpacity={0.8}
                  onPress={() => setTermsChecked((prev) => !prev)}
                >
                  <View
                    style={[
                      styles.checkboxBox,
                      termsChecked && styles.checkboxBoxChecked
                    ]}
                  >
                    {termsChecked && <Text style={styles.checkboxCheck}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>
                    By clicking sign up, I hereby agree and consent to Bloomi&apos;s{' '}
                    <Text
                      style={styles.checkboxLink}
                      onPress={() => Linking.openURL('https://bloomi.app/terms')}
                    >
                      Term &amp; Conditions
                    </Text>{' '}
                    and{' '}
                    <Text
                      style={styles.checkboxLink}
                      onPress={() => Linking.openURL('https://bloomi.app/privacy')}
                    >
                      Privacy Policy
                    </Text>
                    .
                  </Text>
                </TouchableOpacity>
              </View>

              {error ? (
                <Text style={styles.errorText}>
                  {error}
                </Text>
              ) : null}

              {/* Sign up button */}
              <Button
                title="Sign up"
                onPress={handleSignUp}
                variant="primary-green"
                disabled={!canSubmit || loading}
                loading={loading}
                style={[
                  styles.signupButton,
                  (!canSubmit || loading) && styles.signupButtonDisabled
                ]}
                textStyle={styles.signupButtonText}
              />

              {/* Login link */}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12
  },
  backArrow: {
    fontSize: 20,
    color: theme.colors.textPrimary
  },
  headerTitle: {
    ...theme.typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.textPrimary
  },
  headerSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E5E5'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 24
  },
  content: {
    flex: 1,
    paddingTop: 24
  },
  fieldGroup: {
    paddingHorizontal: 20,
    marginBottom: 20
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.textPrimary,
    marginBottom: 4
  },
  fieldInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    paddingVertical: 4
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.textPrimary,
    paddingVertical: 4
  },
  eyeIcon: {
    fontSize: 18,
    marginLeft: 8
  },
  interestSection: {
    marginTop: 24,
    paddingHorizontal: 20
  },
  interestLabel: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.colors.textPrimary
  },
  interestPillsRow: {
    flexDirection: 'row',
    marginTop: 12,
    columnGap: 8
  },
  pill: {
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  pillInactive: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    backgroundColor: '#FFFFFF'
  },
  pillActive: {
    borderWidth: 1,
    borderColor: '#C3EA4F',
    backgroundColor: '#C3EA4F26'
  },
  pillText: {
    fontSize: 15,
    color: theme.colors.textPrimary
  },
  checkboxSection: {
    marginTop: 24,
    paddingHorizontal: 20,
    rowGap: 16
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start'
  },
  checkboxBox: {
    width: 16,
    height: 16,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: '#CCCCCC',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2
  },
  checkboxBoxChecked: {
    backgroundColor: '#C3EA4F',
    borderColor: '#C3EA4F'
  },
  checkboxCheck: {
    color: theme.colors.appleBlack,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '400',
    color: theme.colors.textPrimary,
    marginLeft: 10
  },
  checkboxLink: {
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
    color: theme.colors.textPrimary
  },
  errorText: {
    ...theme.typography.body,
    color: '#ef4444',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 20
  },
  signupButton: {
    marginTop: 32,
    marginBottom: 24,
    marginHorizontal: 16,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#C3EA4F'
  },
  signupButtonDisabled: {
    backgroundColor: '#E5E5E5',
    opacity: 0.5
  },
  signupButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.appleBlack
  },
  loginLink: {
    alignItems: 'center',
    marginBottom: 16
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
