/**
 * Composant ModalCard - Design System Bloomi
 * Pour modal "Check your email" avec blur overlay
 */

import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

interface ModalCardProps {
  visible: boolean;
  onClose: () => void;
  icon?: React.ReactNode;
  title: string;
  message: string;
  buttonText?: string;
  onButtonPress?: () => void;
}

export function ModalCard({
  visible,
  onClose,
  icon,
  title,
  message,
  buttonText,
  onButtonPress
}: ModalCardProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.card}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            {buttonText && onButtonPress && (
              <TouchableOpacity
                style={styles.button}
                onPress={onButtonPress}
                activeOpacity={0.8}
              >
                <Text style={styles.buttonText}>{buttonText}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.horizontalPadding
  },
  container: {
    width: '100%',
    maxWidth: 375,
    alignItems: 'center'
  },
  card: {
    backgroundColor: theme.colors.googleWhite,
    borderRadius: 20,
    padding: 32,
    width: '100%',
    alignItems: 'center'
  },
  iconContainer: {
    marginBottom: 24
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 12
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.buttonRadius,
    paddingVertical: 14,
    paddingHorizontal: 32,
    minWidth: 200
  },
  buttonText: {
    ...theme.typography.button,
    color: theme.colors.appleBlack,
    textAlign: 'center'
  }
});
