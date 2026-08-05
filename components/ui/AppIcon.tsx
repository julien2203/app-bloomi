import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';
import { icons, type IconName } from '../../lib/assets';

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Contour uniquement (pas de remplissage) — ex. cœur fiche produit */
  outline?: boolean;
  strokeWidth?: number;
}

/**
 * Les SVG peuvent avoir une hitbox iOS imprécise et « voler » les touches au Touchable parent.
 * pointerEvents="none" : la cible tactile est le parent (bouton), pas les paths du SVG.
 */
export function AppIcon({ name, size = 24, color, style, outline, strokeWidth }: AppIconProps) {
  const Icon = icons[name];
  return (
    <View
      pointerEvents="none"
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Icon
        width={size}
        height={size}
        color={color}
        fill={outline ? 'none' : color}
        stroke={outline ? color : undefined}
        strokeWidth={outline ? (strokeWidth ?? 2) : undefined}
      />
    </View>
  );
}

