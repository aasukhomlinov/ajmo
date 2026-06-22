import { Check, Info, WarningCircle, type IconProps } from 'phosphor-react-native';
import type { ComponentType } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Snackbar on bg/raised + Shadow/Overlay. Status-colored icon + message +
// optional lime action (UNDO/RETRY).
export type ToastTone = 'info' | 'success' | 'error';

const toneIcon: Record<ToastTone, { Icon: ComponentType<IconProps>; color: string }> = {
  info: { Icon: Info, color: theme.colors.text.secondary },
  success: { Icon: Check, color: theme.colors.success },
  error: { Icon: WarningCircle, color: theme.colors.error },
};

export interface ToastProps {
  message: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Toast({ message, tone = 'info', actionLabel, onAction, style }: ToastProps) {
  const { Icon, color } = toneIcon[tone];

  return (
    <View style={[styles.base, style]}>
      <Icon size={24} color={color} />
      <Text variant="bodySmall" color={theme.colors.text.primary} style={styles.message}>
        {message}
      </Text>
      {actionLabel ? (
        <Pressable onPress={onAction} accessibilityRole="button">
          <Text variant="button" color={theme.colors.accent.base} style={styles.action}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
    backgroundColor: theme.colors.surface.raised,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadows.overlay,
  },
  message: {
    flex: 1,
  },
  action: {
    textTransform: 'uppercase',
  },
});
