import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Screen } from '../../../components/ui/Screen';
import { Text } from '../../../components/ui/Text';
import { theme } from '../../../lib/theme';

export default function SearchScreen() {
  return (
    <Screen>
      <View style={styles.container}>
        <Text variant="h2">Search</Text>
        <Text variant="body" color="textSecondary" style={styles.subtitle}>
          Écran de recherche (à implémenter).
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.screenPaddingX
  },
  subtitle: {
    marginTop: theme.spacing.gapSm,
    textAlign: 'center'
  }
});

