import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { HeaderBackButton } from '../../components/ui/HeaderBackButton';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { supabase } from '../../lib/supabase';
import { theme } from '../../lib/theme';
import { useTranslation } from 'react-i18next';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (loading) return;

    if (!password || password.length < 8) {
      Alert.alert(t('auth.password'), t('auth.resetPassword.minLength'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('auth.password'), t('auth.resetPassword.noMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert(t('auth.resetPassword.updatedTitle'), t('auth.resetPassword.updatedMessage'), [
        { text: t('common.ok'), onPress: () => router.replace('/auth/login') }
      ]);
    } catch (error) {
      Alert.alert(t('common.error'), t('auth.resetPassword.unableUpdate'));
      console.warn('Failed to update password:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <HeaderBackButton
            onPress={() => {
              if (router.canGoBack && router.canGoBack()) {
                router.back();
              } else {
                router.replace('/auth/login');
              }
            }}
          />
          <View style={{ flex: 1 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <Text style={styles.title}>{t('auth.resetPassword.newPassword')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.resetPassword.subtitle')}
              </Text>

              <TextField
                label={t('auth.resetPassword.newPassword')}
                value={password}
                onChangeText={setPassword}
                placeholder="********"
                secureTextEntry
                autoCapitalize="none"
                style={styles.field}
              />

              <TextField
                label={t('auth.resetPassword.confirmPassword')}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="********"
                secureTextEntry
                autoCapitalize="none"
                style={styles.field}
              />

              <Button
                title={t('auth.resetPassword.update')}
                onPress={handleUpdatePassword}
                variant="primary-green"
                loading={loading}
                disabled={!password || !confirmPassword}
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
  field: {
    marginBottom: 16
  },
  button: {
    marginTop: 12
  }
});
