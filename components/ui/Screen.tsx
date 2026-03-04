import React, { ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  ViewStyle,
  ScrollViewProps,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../lib/theme';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  scrollProps?: Omit<ScrollViewProps, 'style' | 'contentContainerStyle'>;
  noHorizontalPadding?: boolean;
}

export function Screen({
  children,
  scroll = false,
  style,
  scrollProps,
  noHorizontalPadding = false
}: ScreenProps) {
  if (scroll) {
    return (
      <SafeAreaView style={[styles.root, style]} edges={['left', 'right']}>
        <ScrollView
          {...scrollProps}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            noHorizontalPadding && styles.noHorizontalPadding
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, style]}>
      <View
        style={[styles.content, noHorizontalPadding && styles.noHorizontalPadding]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  noHorizontalPadding: {
    paddingHorizontal: 0
  },
  scroll: {
    flex: 1
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.screenPaddingX,
    paddingBottom: theme.spacing.gapLg * 2
  }
});

