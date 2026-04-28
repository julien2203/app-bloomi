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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdatePassword = async () => {
    if (loading) return;

    if (!password || password.length < 8) {
      Alert.alert('Mot de passe', 'Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Mot de passe', 'Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Mot de passe mis à jour', 'Votre mot de passe a bien été modifié.', [
        { text: 'OK', onPress: () => router.replace('/auth/login') }
      ]);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de mettre à jour votre mot de passe. Réessayez.');
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
              <Text style={styles.title}>Nouveau mot de passe</Text>
              <Text style={styles.subtitle}>
                Saisissez votre nouveau mot de passe pour finaliser la réinitialisation.
              </Text>

              <TextField
                label="Nouveau mot de passe"
                value={password}
                onChangeText={setPassword}
                placeholder="********"
                secureTextEntry
                autoCapitalize="none"
                style={styles.field}
              />

              <TextField
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="********"
                secureTextEntry
                autoCapitalize="none"
                style={styles.field}
              />

              <Button
                title="Mettre à jour le mot de passe"
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
