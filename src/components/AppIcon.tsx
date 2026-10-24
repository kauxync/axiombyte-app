import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';
import { useAppTheme } from '@/context/ThemeContext';

export interface AppIconProps {
  /** Size in pixels (width and height). Defaults to 32 */
  size?: number;
  /** Explicit theme override: 'light' | 'dark' | 'auto'. Defaults to 'auto' */
  theme?: 'light' | 'dark' | 'auto';
  /** Optional custom styling for the Image component */
  style?: StyleProp<ImageStyle>;
  /** Optional accessibility label */
  accessibilityLabel?: string;
}

const iconLight = require('../../assets/images/icon-light.png');
const iconDark = require('../../assets/images/icon-dark.png');

/**
 * AxiomByte App Icon component that automatically switches between
 * `icon-light.png` and `icon-dark.png` based on the active theme.
 */
export function AppIcon({
  size = 32,
  theme = 'auto',
  style,
  accessibilityLabel = 'AxiomByte App Icon',
}: AppIconProps) {
  const { isDark } = useAppTheme();

  const useDark = theme === 'auto' ? isDark : theme === 'dark';
  const source = useDark ? iconDark : iconLight;

  return (
    <Image
      source={source}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    />
  );
}

export default AppIcon;

