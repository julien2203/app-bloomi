/**
 * Composant DividerOr - Design System Bloomi
 * Séparateur "or" entre éléments
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

interface DividerOrProps {
  variant?: 'default' | 'light';
}

export function DividerOr({ variant = 'default' }: DividerOrProps) {
  const isLight = variant === 'light';

  return (
    <View style={styles.container}>
      <View style={[styles.line, isLight && styles.lineLight]} />
      <Text style={[styles.text, isLight && styles.textLight]}>or</Text>
      <View style={[styles.line, isLight && styles.lineLight]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.gapLg
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border
  },
  lineLight: {
    backgroundColor: 'rgba(255,255,255,0.4)'
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginHorizontal: 16
  },
  textLight: {
    color: '#FFFFFF'
  }
});
