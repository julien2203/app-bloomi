import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { theme } from '../../lib/theme';
import {
  listingPickupDisplayLines,
  type ListingPickupSnapshotFields
} from '../../lib/pickupAddress';

type ListingPickupAddressesProps = {
  listing: ListingPickupSnapshotFields;
};

export function ListingPickupAddresses({ listing }: ListingPickupAddressesProps) {
  const lines = useMemo(() => listingPickupDisplayLines(listing), [listing]);

  if (lines.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    gap: 2
  },
  line: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.primary,
    fontFamily: theme.fontFamily.medium
  }
});
