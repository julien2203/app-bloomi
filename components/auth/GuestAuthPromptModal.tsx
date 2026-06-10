import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { theme } from '../../lib/theme';
import { useGuestAuthModalStore } from '../../stores/guestAuthModalStore';
import { useTranslation } from 'react-i18next';

export function GuestAuthPromptModal() {
  const { t } = useTranslation();
  const router = useRouter();
  const visible = useGuestAuthModalStore((s) => s.visible);
  const close = useGuestAuthModalStore((s) => s.close);

  const goSignUp = () => {
    close();
    router.push('/auth/sign-up');
  };

  const goLogin = () => {
    close();
    router.push('/auth/login');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={() => null}>
          <Text variant="h3" style={styles.title}>
            {t('auth.guestPrompt.title')}
          </Text>
          <Text variant="body" color="textSecondary" style={styles.subtitle}>
            {t('auth.guestPrompt.subtitle')}
          </Text>
          <Button
            title={t('auth.signUp.title')}
            onPress={goSignUp}
            variant="primary-green"
            style={styles.primaryBtn}
          />
          <Button title={t('auth.login.submit')} onPress={goLogin} variant="secondary" style={styles.secondaryBtn} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 22
  },
  title: {
    textAlign: 'center',
    marginBottom: 10,
    color: theme.colors.textPrimary
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 22
  },
  primaryBtn: {
    marginBottom: 10
  },
  secondaryBtn: {
    marginBottom: 0
  }
});
