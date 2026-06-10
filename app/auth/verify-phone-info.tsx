/**
 * Écran Verify Phone Info
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Keypad } from '../../components/ui/Keypad';
import { theme } from '../../lib/theme';

export default function VerifyPhoneInfoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [phone, setPhone] = useState('');

  const handleKeyPress = (value: string) => {
    setPhone((prev) => prev + value);
  };

  const handleBackspace = () => {
    setPhone((prev) => prev.slice(0, -1));
  };

  const handleVerify = () => {
    router.push('/auth/verify-phone-code');
  };

  return (
    <>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.verifyPhoneInfo.pleaseVerifyTitle')}</Text>
            <Text style={styles.subtitle}>{t('auth.verifyPhoneInfo.subtitle')}</Text>
          </View>

          <View style={styles.inputContainer}>
            <TextField
              label={t('auth.verifyPhoneInfo.phoneNumber')}
              value={phone}
              onChangeText={setPhone}
              placeholder={t('auth.verifyPhoneInfo.phonePlaceholder')}
              keyboardType="phone-pad"
              editable={false}
            />
          </View>

          <View style={styles.keypadContainer}>
            <Keypad onPress={handleKeyPress} onBackspace={handleBackspace} />
          </View>

          <View style={styles.footer}>
            <Button
              title={t('auth.verifyPhoneInfo.title')}
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
    flex: 1,
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  header: {
    paddingTop: 24,
    paddingBottom: 16
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    marginBottom: 8
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  inputContainer: {
    marginBottom: 16
  },
  keypadContainer: {
    flex: 1,
    justifyContent: 'center'
  },
  footer: {
    paddingBottom: 24
  }
});
