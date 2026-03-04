/**
 * Composant TextField - Design System Bloomi
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
}

export function TextField({
  label,
  error,
  secureTextEntry = false,
  showToggle = false,
  style,
  ...props
}: TextFieldProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <TextInput
          style={[styles.input, style]}
          secureTextEntry={isSecure}
          placeholderTextColor={theme.colors.textSecondary}
          {...props}
        />
        {showToggle && secureTextEntry && (
          <TouchableOpacity
            onPress={() => setIsSecure(!isSecure)}
            style={styles.toggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isSecure ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.gapMd
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.gapSm
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    backgroundColor: theme.colors.background
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingVertical: theme.spacing.gapSm,
    minHeight: theme.spacing.buttonHeight
  },
  toggle: {
    paddingRight: theme.spacing.gapMd
  },
  inputError: {
    borderColor: theme.colors.danger
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.danger,
    marginTop: theme.spacing.gapSm / 2
  }
});
