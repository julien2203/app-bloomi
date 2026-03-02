/**
 * Composant Modal "Check your email"
 * Carte centrée arrondie + icône mail dans cercle vert + titre + texte (sur fond blur/dim)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ModalCard } from './ui/ModalCard';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../lib/theme';

interface CheckEmailModalProps {
  visible: boolean;
  onClose: () => void;
  email?: string;
}

export function CheckEmailModal({ visible, onClose, email }: CheckEmailModalProps) {
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
      title="Check your email"
      message={
        email
          ? `We've sent a verification link to ${email}. Please check your inbox and click the link to verify your account.`
          : "We've sent a verification link to your email address. Please check your inbox and click the link to verify your account."
      }
      buttonText="Got it"
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
