/**
 * Composant DividerOr - Design System Bloomi
 * Séparateur "or" entre éléments
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

export function DividerOr() {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.text}>or</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB'
  },
  text: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginHorizontal: 16
  }
});
