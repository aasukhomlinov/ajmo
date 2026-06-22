import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Afiša direction CTA. Uppercase condensed label, radius/md, 44px tall.
// Type: Primary (lime) / Secondary (hairline outline) / Text (bare lime).
// Figma's Pressed/Disabled states map to RN runtime states (Pressable + disabled).
export type ButtonType = 'primary' | 'secondary' | 'text';

const labelColors: Record<ButtonType, string> = {
  primary: theme.colors.text.onAccent,
  secondary: theme.colors.text.primary,
  text: theme.colors.accent.base,
};

export interface ButtonProps {
  label: string;
  type?: ButtonType;
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  type = 'primary',
  onPress,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        styles[type],
        pressed && pressedStyles[type],
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text variant="button" color={labelColors[type]} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 44,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
  primary: {
    backgroundColor: theme.colors.accent.base,
  },
  secondary: {
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  text: {
    paddingHorizontal: theme.spacing.sm,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    textTransform: 'uppercase',
  },
});

const pressedStyles = StyleSheet.create({
  primary: {
    backgroundColor: theme.colors.accent.pressed,
  },
  secondary: {
    backgroundColor: theme.colors.surface.raised,
  },
  text: {
    opacity: 0.6,
  },
});
