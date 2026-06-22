import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

// 44×44 icon-only button. Pass any Phosphor icon (size 24) via `icon`.
// variant: surface (surface + hairline) / ghost. Figma Pressed (raised) /
// Disabled states map to Pressable + `disabled`.
export type IconButtonVariant = 'surface' | 'ghost';

export interface IconButtonProps {
  icon: ReactNode;
  variant?: IconButtonVariant;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon,
  variant = 'surface',
  onPress,
  disabled = false,
  accessibilityLabel,
  style,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        variant === 'surface' && styles.surface,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.icon}>{icon}</View>
    </Pressable>
  );
}

const SIZE = 44;
const ICON_SIZE = 24;

const styles = StyleSheet.create({
  base: {
    width: SIZE,
    height: SIZE,
    borderRadius: theme.radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  surface: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
  },
  pressed: {
    backgroundColor: theme.colors.surface.raised,
  },
  disabled: {
    opacity: 0.4,
  },
  icon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
