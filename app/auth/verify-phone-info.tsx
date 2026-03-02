/**
 * Écran Verify Phone Info
 * Titre "Please verify your information" + input phone + bouton "Verify phone number" + clavier numérique visuel en bas
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

export default function VerifyPhoneInfoScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');

  const handleKeyPress = (value: string) => {
    setPhone((prev) => prev + value);
  };

  const handleBackspace = () => {
    setPhone((prev) => prev.slice(0, -1));
  };

  const handleVerify = () => {
    // TODO: Implémenter la vérification
    router.push('/auth/verify-phone-code');
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Please verify your information</Text>
            <Text style={styles.subtitle}>
              Enter your phone number to continue
            </Text>
          </View>

          <View style={styles.inputContainer}>
            <TextField
              label="Phone number"
              value={phone}
              onChangeText={setPhone}
              placeholder="+41 79 123 45 67"
              keyboardType="phone-pad"
              editable={false}
            />
          </View>

          <View style={styles.keypadContainer}>
            <Keypad onPress={handleKeyPress} onBackspace={handleBackspace} />
          </View>

          <View style={styles.footer}>
            <Button
              title="Verify phone number"
              onPress={handleVerify}
              variant="primary-green"
              disabled={!phone}
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
