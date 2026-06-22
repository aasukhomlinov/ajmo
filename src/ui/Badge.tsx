import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Non-interactive status pill (vs Chip = interactive filter). Caption,
// uppercase, radius/sm. Bright tones use a solid fill with dark on-accent text.
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'error';

const toneColors: Record<BadgeTone, { background: string; foreground: string }> = {
  neutral: { background: theme.colors.surface.raised, foreground: theme.colors.text.secondary },
  accent: { background: theme.colors.accent.base, foreground: theme.colors.text.onAccent },
  success: { background: theme.colors.success, foreground: theme.colors.text.onAccent },
  warning: { background: theme.colors.warning, foreground: theme.colors.text.onAccent },
  error: { background: theme.colors.error, foreground: theme.colors.text.onAccent },
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const colors = toneColors[tone];
  return (
    <View style={[styles.base, { backgroundColor: colors.background }, style]}>
      <Text variant="caption" color={colors.foreground} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.sm,
  },
  label: {
    textTransform: 'uppercase',
  },
});
