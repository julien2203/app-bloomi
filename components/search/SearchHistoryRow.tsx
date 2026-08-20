import React, { useMemo, useRef } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../lib/theme';
import { Text } from '../ui/Text';
import { HIT_SLOP_COMFORTABLE } from '../../lib/touchTargets';

const SWIPE_DELETE_THRESHOLD = 72;

type Props = {
  query: string;
  onPress: () => void;
  onRemove: () => void;
  showSeparator: boolean;
};

export function SearchHistoryRow({ query, onPress, onRemove, showSeparator }: Props) {
  const { t } = useTranslation();
  const translateX = useRef(new Animated.Value(0)).current;
  const startX = useRef(0);
  const removedRef = useRef(false);
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
        onPanResponderGrant: () => {
          removedRef.current = false;
          translateX.stopAnimation((value) => {
            startX.current = value;
          });
        },
        onPanResponderMove: (_, g) => {
          translateX.setValue(Math.min(0, startX.current + g.dx));
        },
        onPanResponderRelease: (_, g) => {
          const next = startX.current + g.dx;
          if (g.dx < -SWIPE_DELETE_THRESHOLD || next < -SWIPE_DELETE_THRESHOLD) {
            removedRef.current = true;
            Animated.timing(translateX, {
              toValue: -120,
              duration: 140,
              useNativeDriver: true
            }).start(() => onRemoveRef.current());
            return;
          }
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 18
          }).start();
        },
        onPanResponderTerminate: () => {
          if (removedRef.current) return;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 18
          }).start();
        }
      }),
    [translateX]
  );

  return (
    <View style={styles.clip}>
      <View style={styles.deleteTrack} pointerEvents="none">
        <Text style={styles.deleteTrackLabel}>{t('common.delete')}</Text>
      </View>
      <Animated.View
        style={[styles.foreground, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
          <View style={styles.iconBox}>
            <Ionicons name="time-outline" size={16} color={theme.colors.sectionLabel} />
          </View>
          <Text style={styles.label} numberOfLines={1}>
            {query}
          </Text>
          <TouchableOpacity
            onPress={onRemove}
            hitSlop={HIT_SLOP_COMFORTABLE}
            style={styles.removeHit}
            accessibilityRole="button"
            accessibilityLabel={t('filters.removeRecentSearch')}
          >
            <Text style={styles.removeText}>×</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
      {showSeparator ? <View style={styles.separator} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden'
  },
  deleteTrack: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.danger,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 18
  },
  deleteTrackLabel: {
    ...theme.typography.captionSm,
    color: theme.colors.googleWhite,
    fontFamily: theme.fontFamily.medium
  },
  foreground: {
    backgroundColor: theme.colors.background
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: theme.spacing.gapMd
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: theme.colors.muted,
    alignItems: 'center',
    justifyContent: 'center'
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    flex: 1,
    fontSize: 16
  },
  removeHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center'
  },
  removeText: {
    fontSize: 20,
    lineHeight: 22,
    color: theme.colors.sectionLabel
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.separator,
    marginLeft: 36 + theme.spacing.gapMd
  }
});
