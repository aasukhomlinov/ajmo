import type { Icon } from 'phosphor-react-native';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Interactive filter chip (vs Badge = non-interactive label). Caption condensed
// uppercase, radius/sm. Default: surface + hairline border. Active: hard lime fill.
// Optional left icon slot mirrors the DS Chip's ShowLeftIcon/LeftIcon: pass a
// Phosphor icon component; the chip sizes it to 16 and tints it to the label
// (outline when idle, fill when active — per the DS icon convention).
const ICON_SIZE = 16;

export interface ChipProps {
  label: string;
  active?: boolean;
  /** Phosphor icon rendered before the label (16px, tinted to the label color). */
  leftIcon?: Icon;
  /**
   * Uppercase the label (DS default for filter chips). Set `false` to preserve
   * casing for verbatim labels such as recent-search queries (Search · Empty).
   */
  uppercase?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  label,
  active = false,
  leftIcon: LeftIcon,
  uppercase = true,
  onPress,
  style,
}: ChipProps) {
  const contentColor = active ? theme.colors.text.onAccent : theme.colors.text.secondary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.base, active ? styles.active : styles.default, style]}
    >
      {LeftIcon ? (
        <LeftIcon size={ICON_SIZE} color={contentColor} weight={active ? 'fill' : 'regular'} />
      ) : null}
      <Text
        variant="caption"
        color={contentColor}
        style={uppercase ? styles.label : undefined}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  default: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
  },
  active: {
    backgroundColor: theme.colors.accent.base,
  },
  label: {
    textTransform: 'uppercase',
  },
});
