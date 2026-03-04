/**
 * Composant Checkbox - Design System Bloomi
 */

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

interface CheckboxProps {
  checked: boolean;
  onPress: () => void;
  label?: string;
  labelComponent?: React.ReactNode;
}

export function Checkbox({ checked, onPress, label, labelComponent }: CheckboxProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && (
          <Ionicons name="checkmark" size={16} color={theme.colors.appleBlack} />
        )}
      </View>
      {(label || labelComponent) && (
        <View style={styles.labelContainer}>
          {label ? (
            <Text style={styles.label}>{label}</Text>
          ) : (
            labelComponent
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.gapSm
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12
  },
  checkboxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  labelContainer: {
    flex: 1
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.textPrimary
  }
});
