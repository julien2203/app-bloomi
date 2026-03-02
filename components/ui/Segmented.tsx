/**
 * Composant Segmented Control - Design System Bloomi
 * Pour choix Selling / Buying / Both
 */

import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { theme } from '../../lib/theme';

interface SegmentedOption {
  label: string;
  value: string;
}

interface SegmentedProps {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
}

export function Segmented({ options, value, onValueChange }: SegmentedProps) {
  return (
    <View style={styles.container}>
      {options.map((option, index) => {
        const isSelected = option.value === value;
        const isFirst = index === 0;
        const isLast = index === options.length - 1;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.segment,
              isFirst && styles.segmentFirst,
              isLast && styles.segmentLast,
              isSelected && styles.segmentSelected
            ]}
            onPress={() => onValueChange(option.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                isSelected && styles.segmentTextSelected
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: theme.radius.buttonRadius,
    padding: 4
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.buttonRadius - 4
  },
  segmentFirst: {
    marginRight: 2
  },
  segmentLast: {
    marginLeft: 2
  },
  segmentSelected: {
    backgroundColor: theme.colors.googleWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  segmentText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary
  },
  segmentTextSelected: {
    color: theme.colors.textPrimary,
    fontWeight: '600'
  }
});
