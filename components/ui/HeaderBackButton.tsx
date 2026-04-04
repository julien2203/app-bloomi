import React from 'react';
import { Platform, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { theme } from '../../lib/theme';
import { HIT_SLOP_COMFORTABLE, HEADER_ICON_TOUCH_CONTAINER } from '../../lib/touchTargets';
import { AppIcon } from './AppIcon';

type Props = Omit<PressableProps, 'children'> & {
  accessibilityLabel?: string;
};

/**
 * Bouton retour header : zone ≥44×44 + hitSlop (iOS / Android).
 * Pressable + delayPressIn 0 : moins de conflit avec les scroll / délais iOS que TouchableOpacity.
 */
export function HeaderBackButton({
  style,
  accessibilityLabel = 'Retour',
  hitSlop = HIT_SLOP_COMFORTABLE,
  ...rest
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      delayPressIn={0}
      android_disableSound
      style={(state) => [
        styles.base,
        typeof style === 'function' ? style(state) : style,
        Platform.OS === 'ios' && state.pressed && styles.pressed
      ]}
      {...rest}
    >
      <AppIcon name="arrowLeftOutline" size={20} color={theme.colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: HEADER_ICON_TOUCH_CONTAINER,
  pressed: {
    opacity: 0.65
  }
});
