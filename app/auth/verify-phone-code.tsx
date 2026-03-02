/**
 * Écran Verify Phone Code
 * Titre "Verify your phone number" + texte "We sent a text message..." + input code + bouton "Verify" + clavier numérique visuel en bas
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Keypad } from '../../components/ui/Keypad';
import { theme } from '../../lib/theme';
import { useAuthStore } from '../../stores/authStore';

export default function VerifyPhoneCodeScreen() {
  const router = useRouter();
  const { setMockSession } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleKeyPress = (value: string) => {
    if (code.length < 6) {
      setCode((prev) => prev + value);
    }
  };

  const handleBackspace = () => {
    setCode((prev) => prev.slice(0, -1));
  };

  const handleVerify = async () => {
    // TODO: Implémenter la vérification du code avec Supabase
    // TEMPORAIRE: Créer une session mock pour le développement
    setLoading(true);
    setTimeout(() => {
      setMockSession(); // Crée une session mock
      setLoading(false);
      router.replace('/tabs/feed');
    }, 1000);
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Verify your phone number</Text>
            <Text style={styles.subtitle}>
              We sent a text message to your phone number. Please enter the verification code below.
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextField
              label="Verification code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              editable={false}
            />
          </View>

          <View style={styles.keypadContainer}>
            <Keypad onPress={handleKeyPress} onBackspace={handleBackspace} />
          </View>

          <View style={styles.footer}>
            <Button
              title="Verify"
              onPress={handleVerify}
              variant="primary-green"
              loading={loading}
              disabled={code.length !== 6}
            />
          </View>
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
  content: {
    flex: 1
  },
  header: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingTop: 48,
    paddingBottom: 32
  },
  title: {
    ...theme.typography.h1,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  inputContainer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    marginBottom: 24
  },
  keypadContainer: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  footer: {
    paddingHorizontal: theme.spacing.horizontalPadding,
    paddingBottom: 32,
    paddingTop: 16
  }
});
