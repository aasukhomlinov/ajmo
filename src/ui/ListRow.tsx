import { CaretRight } from 'phosphor-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Generic list / settings row — composes inside a card or Screen (transparent
// bg). Optional leading icon, a label (+ secondary description), and a trailing
// slot: pass `trailing` (e.g. a Toggle/Badge), a `value` string, or rely on the
// auto chevron when `onPress` is set. Structural primitive (no dedicated DS node).
const CHEVRON_SIZE = 20;

export interface ListRowProps {
  label: string;
  description?: string;
  leftIcon?: ReactNode;
  value?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  /** Force the chevron on/off. Defaults to shown when `onPress` is set and no other trailing content exists. */
  showChevron?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ListRow({
  label,
  description,
  leftIcon,
  value,
  trailing,
  onPress,
  showChevron,
  disabled = false,
  style,
}: ListRowProps) {
  const hasTrailingContent = trailing != null || value != null;
  const chevron = (showChevron ?? (!!onPress && !hasTrailingContent)) ? (
    <CaretRight size={CHEVRON_SIZE} color={theme.colors.text.secondary} />
  ) : null;

  const labelColor = disabled ? theme.colors.text.disabled : theme.colors.text.primary;

  const content = (
    <>
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <View style={styles.labels}>
        <Text variant="body" color={labelColor} numberOfLines={1}>
          {label}
        </Text>
        {description ? (
          <Text variant="bodySmall" color={theme.colors.text.secondary} numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {value != null ? (
        <Text variant="body" color={theme.colors.text.secondary} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
      {chevron}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled, style]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.row, disabled && styles.disabled, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 56,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  leftIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labels: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  pressed: {
    backgroundColor: theme.colors.surface.raised,
  },
  disabled: {
    opacity: 0.5,
  },
});
