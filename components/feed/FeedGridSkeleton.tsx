import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GRID_GAP, GRID_PADDING_X } from '../../lib/cardLayout';

const SKELETON_COUNT = 6;

type FeedGridSkeletonProps = {
  cardWidth: number;
};

/** Placeholder grille feed pendant le chargement initial (Android : évite l'écran spinner plein page). */
export function FeedGridSkeleton({ cardWidth }: FeedGridSkeletonProps) {
  const rows = Math.ceil(SKELETON_COUNT / 2);
  return (
    <View style={styles.wrap}>
      {Array.from({ length: rows }, (_, rowIndex) => (
        <View key={`sk-row-${rowIndex}`} style={styles.row}>
          {[0, 1].map((col) => {
            const idx = rowIndex * 2 + col;
            if (idx >= SKELETON_COUNT) return null;
            return (
              <View
                key={`sk-${idx}`}
                style={[styles.cell, { width: cardWidth, height: cardWidth * 1.35 }]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: GRID_PADDING_X,
    paddingTop: 8,
    gap: GRID_GAP
  },
  row: {
    flexDirection: 'row',
    gap: GRID_GAP
  },
  cell: {
    borderRadius: 12,
    backgroundColor: '#E8E8E8'
  }
});
