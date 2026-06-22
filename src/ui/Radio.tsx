import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// 24px circle. Checked: hard lime fill + on-accent 10px dot.
// Disabled: raised + disabled text. Optional Body label.
const RING_SIZE = 24;
const DOT_SIZE = 10;

export interface RadioProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Radio({ checked, onChange, label, disabled = false, style }: RadioProps) {
  const ringStyle = checked
    ? disabled
      ? styles.ringCheckedDisabled
      : styles.ringChecked
    : styles.ringUnchecked;
  const dotColor = disabled ? theme.colors.text.disabled : theme.colors.text.onAccent;

  return (
    <Pressable
      onPress={() => onChange?.(true)}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ selected: checked, disabled }}
      style={[styles.row, style]}
    >
      <View style={[styles.ring, ringStyle]}>
        {checked ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      </View>
      {label ? (
        <Text
          variant="body"
          color={disabled ? theme.colors.text.disabled : theme.colors.text.primary}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  ring: {
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: theme.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ringUnchecked: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
  },
  ringChecked: {
    backgroundColor: theme.colors.accent.base,
  },
  ringCheckedDisabled: {
    backgroundColor: theme.colors.surface.raised,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: theme.radii.full,
  },
});
