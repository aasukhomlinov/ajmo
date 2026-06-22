import { Check } from 'phosphor-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// 24px box, radius/sm. Checked: hard lime fill + on-accent check.
// Disabled: raised box + disabled text. Optional Body label.
const BOX_SIZE = 24;
const MARK_SIZE = 16;

export interface CheckboxProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Checkbox({ checked, onChange, label, disabled = false, style }: CheckboxProps) {
  const boxStyle = checked
    ? disabled
      ? styles.boxCheckedDisabled
      : styles.boxChecked
    : styles.boxUnchecked;
  const markColor = disabled ? theme.colors.text.disabled : theme.colors.text.onAccent;

  return (
    <Pressable
      onPress={() => onChange?.(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[styles.row, style]}
    >
      <View style={[styles.box, boxStyle]}>
        {checked ? <Check size={MARK_SIZE} weight="bold" color={markColor} /> : null}
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
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderRadius: theme.radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  boxUnchecked: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
  },
  boxChecked: {
    backgroundColor: theme.colors.accent.base,
  },
  boxCheckedDisabled: {
    backgroundColor: theme.colors.surface.raised,
  },
});
