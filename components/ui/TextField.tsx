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
    marginBottom: 16
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 8,
    fontWeight: '500'
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: theme.radius.buttonRadius,
    backgroundColor: theme.colors.googleWhite
  },
  input: {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: theme.spacing.buttonHeight
  },
  toggle: {
    paddingRight: 16
  },
  inputError: {
    borderColor: '#EF4444'
  },
  error: {
    ...theme.typography.caption,
    color: '#EF4444',
    marginTop: 4
  }
});
