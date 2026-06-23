// UNUSED in MVP — kept for future use, not wired to any screen.
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

import { Text } from './Text';

// Surface track + hairline; active segment sits on a raised pill (fill icon +
// primary text), inactive uses outline icon + secondary text. DS default is the
// Feed/Map toggle — the active flag lets callers swap Phosphor weight per state.
export interface SegmentItem {
  value: string;
  label: string;
  icon?: (active: boolean) => ReactNode;
}

export interface SegmentedControlProps {
  segments: SegmentItem[];
  value: string;
  onChange?: (value: string) => void;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl({ segments, value, onChange, style }: SegmentedControlProps) {
  return (
    <View style={[styles.track, style]}>
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            onPress={() => onChange?.(segment.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            {segment.icon?.(active)}
            <Text
              variant="button"
              color={active ? theme.colors.text.primary : theme.colors.text.secondary}
              style={styles.label}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: theme.spacing.xs,
    padding: theme.spacing.xs,
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radii.sm,
  },
  segmentActive: {
    backgroundColor: theme.colors.surface.raised,
  },
  label: {
    textTransform: 'uppercase',
  },
});
