import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '@/lib/theme';

// Loading shimmer placeholders — the feed pulls parsed events asynchronously.
// Bars are a raised-tone fill; a looping opacity pulse animates the sheen (no
// extra deps). EventCardSkeleton / EventRowSkeleton mirror the real EventCard /
// EventRow geometry so the swap-in doesn't shift layout. RN target: src/ui/Skeleton.
const PULSE_MIN = 0.4;
const PULSE_MAX = 1;
const PULSE_DURATION = 800;

// One shared pulse drives every bar in a skeleton so they breathe in sync.
// Pass `active = false` to mint an inert value (used when a parent supplies one).
function usePulse(active: boolean) {
  const value = useRef(new Animated.Value(active ? PULSE_MIN : 1)).current;

  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: PULSE_MAX,
          duration: PULSE_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: PULSE_MIN,
          duration: PULSE_DURATION,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, value]);

  return value;
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  /** Shared pulse from a parent skeleton; omitted = self-animating. */
  pulse?: Animated.Value;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = theme.spacing.lg,
  radius = theme.radii.sm,
  pulse,
  style,
}: SkeletonProps) {
  const self = usePulse(pulse == null);
  const opacity = pulse ?? self;

  return (
    <Animated.View
      style={[styles.bar, { width, height, borderRadius: radius, opacity }, style]}
    />
  );
}

// Mirrors EventCard: 16:10 cover, then title + meta lines over a card surface.
export function EventCardSkeleton() {
  const pulse = usePulse(true);

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.cover, { opacity: pulse }]} />
      <View style={styles.cardBody}>
        <Skeleton pulse={pulse} height={theme.spacing['2xl']} width="80%" radius={theme.radii.md} />
        <Skeleton pulse={pulse} height={theme.spacing.lg} width="55%" />
        <View style={styles.metaRow}>
          <Skeleton pulse={pulse} height={theme.spacing.lg} width={88} />
          <Skeleton pulse={pulse} height={theme.spacing.lg} width={64} />
        </View>
      </View>
    </View>
  );
}

// Mirrors EventRow (DS node 90:3): a flush 94×94 SQUARE thumb (left-rounded) +
// date / title / venue lines, so the skeleton→row swap doesn't shift layout.
export function EventRowSkeleton() {
  const pulse = usePulse(true);

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.rowThumb, { opacity: pulse }]} />
      <View style={styles.rowInfo}>
        <Skeleton pulse={pulse} height={theme.spacing.md} width="35%" />
        <Skeleton pulse={pulse} height={theme.spacing.xl} width="85%" radius={theme.radii.md} />
        <Skeleton pulse={pulse} height={theme.spacing.lg} width="60%" />
      </View>
    </View>
  );
}

const ROW_THUMB = 94;

const styles = StyleSheet.create({
  bar: {
    backgroundColor: theme.colors.surface.raised,
  },
  card: {
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: theme.colors.surface.raised,
  },
  cardBody: {
    gap: theme.spacing.sm,
    padding: theme.spacing.lg,
  },
  metaRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  rowThumb: {
    width: ROW_THUMB,
    height: ROW_THUMB,
    backgroundColor: theme.colors.surface.raised,
    borderTopLeftRadius: theme.radii.md,
    borderBottomLeftRadius: theme.radii.md,
  },
  rowInfo: {
    flex: 1,
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
  },
});
