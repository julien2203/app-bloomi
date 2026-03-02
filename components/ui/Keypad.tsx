/**
 * Composant Keypad - Clavier numérique visuel
 * Design System Bloomi (style iOS)
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../lib/theme';

interface KeypadProps {
  onPress: (value: string) => void;
  onBackspace: () => void;
}

export function Keypad({ onPress, onBackspace }: KeypadProps) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', 'backspace']
  ];

  return (
    <View style={styles.container}>
      {keys.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.row}>
          {row.map((key, keyIndex) => {
            if (key === '') {
              return <View key={keyIndex} style={styles.key} />;
            }

            if (key === 'backspace') {
              return (
                <TouchableOpacity
                  key={keyIndex}
                  style={styles.key}
                  onPress={onBackspace}
                  activeOpacity={0.7}
                >
                  <Ionicons name="backspace-outline" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              );
            }

            return (
              <TouchableOpacity
                key={keyIndex}
                style={styles.key}
                onPress={() => onPress(key)}
                activeOpacity={0.7}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFB',
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  key: {
    flex: 1,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: theme.colors.googleWhite
  },
  keyText: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary
  }
});
