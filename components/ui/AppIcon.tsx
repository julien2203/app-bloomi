import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { icons, type IconName } from '../../lib/assets';

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

export function AppIcon({ name, size = 24, color, style }: AppIconProps) {
  const Icon = icons[name];
  return (
    <Icon
      width={size}
      height={size}
      color={color}
      fill={color}
      stroke={color}
      style={style as any}
    />
  );
}

