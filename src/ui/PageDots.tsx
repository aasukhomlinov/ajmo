import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';

// Pagination dots (onboarding / event-detail Carousel). Active dot = lime pill,
// inactive = disabled-tone circle. Mirrors the Carousel's "lime active page dot".
const DOT_SIZE = 6;
const ACTIVE_WIDTH = 16;

export interface PageDotsProps {
  count: number;
  activeIndex: number;
  style?: StyleProp<ViewStyle>;
}

export function PageDots({ count, activeIndex, style }: PageDotsProps) {
  return (
    <View style={[styles.row, style]} accessibilityRole="tablist">
      {Array.from({ length: count }, (_, index) => {
        const active = index === activeIndex;
        return <View key={index} style={[styles.dot, active ? styles.active : styles.inactive]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    height: DOT_SIZE,
    borderRadius: theme.radii.full,
  },
  active: {
    width: ACTIVE_WIDTH,
    backgroundColor: theme.colors.accent.base,
  },
  inactive: {
    width: DOT_SIZE,
    backgroundColor: theme.colors.text.disabled,
  },
});
