/**
 * Composant Modal "Check your email"
 * Carte centrée arrondie + icône mail dans cercle vert + titre + texte (sur fond blur/dim)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ModalCard } from './ui/ModalCard';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

interface CheckEmailModalProps {
  visible: boolean;
  onClose: () => void;
  email?: string;
}

export function CheckEmailModal({ visible, onClose, email }: CheckEmailModalProps) {
  const { t } = useTranslation();
  const icon = (
    <View style={styles.iconCircle}>
      <Ionicons name="mail" size={32} color={theme.colors.appleBlack} />
    </View>
  );

  return (
    <ModalCard
      visible={visible}
      onClose={onClose}
      icon={icon}
      title={t('auth.checkEmail.title')}
      message={
        email
          ? t('auth.checkEmail.messageWithEmail', { email })
          : t('auth.checkEmail.messageGeneric')
      }
      buttonText={t('auth.checkEmail.gotIt')}
      onButtonPress={onClose}
    />
  );
}

const styles = StyleSheet.create({
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
