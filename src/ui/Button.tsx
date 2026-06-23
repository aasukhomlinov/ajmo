import type { Icon } from 'phosphor-react-native';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Afiša direction CTA. Uppercase condensed label, radius/md, 44px tall.
// Type: Primary (lime) / Secondary (hairline outline) / Text (bare lime).
// Optional left/right Phosphor icons (DS ShowLeftIcon/ShowRightIcon swaps) are
// sized to 20 and auto-tinted to the label color.
// Figma's Pressed/Disabled states map to RN runtime states (Pressable + disabled).
export type ButtonType = 'primary' | 'secondary' | 'text';

const ICON_SIZE = 20;

const labelColors: Record<ButtonType, string> = {
  primary: theme.colors.text.onAccent,
  secondary: theme.colors.text.primary,
  text: theme.colors.accent.base,
};

export interface ButtonProps {
  label: string;
  type?: ButtonType;
  /** Phosphor icon rendered before the label (20px, tinted to the label color). */
  leftIcon?: Icon;
  /** Phosphor icon rendered after the label (20px, tinted to the label color). */
  rightIcon?: Icon;
  onPress?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  type = 'primary',
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  onPress,
  disabled = false,
  fullWidth = false,
  style,
}: ButtonProps) {
  const contentColor = labelColors[type];
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
      {LeftIcon ? <LeftIcon size={ICON_SIZE} color={contentColor} /> : null}
      <Text variant="button" color={contentColor} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {RightIcon ? <RightIcon size={ICON_SIZE} color={contentColor} /> : null}
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
