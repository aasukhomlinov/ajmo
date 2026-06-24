import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { theme } from '@/lib/theme';

import { Badge } from './Badge';

// EventCard cover image area. Image placeholder = surface/raised (swap for photo).
// Bottom scrim = a SOFT vertical gradient easing from transparent to surface/base
// (the card-body color, full alpha at the very bottom) so the photo dissolves into
// the card with no hard edge — and the title/meta stay legible over any photo. Top
// overlay = lime date Badge (left) + neutral category Badge (right). Toggle parts
// off for thumbnails.
//
// DS note: the Figma frame draws this as transparent → surface/base (it blends the
// cover into the surface/base card body, NOT the literal `scrim` token). We follow
// that — over real photos the soft fade to the body color reads far better than a
// hard pill, and readability wins (per the design brief).
const SCRIM_COLOR = theme.colors.surface.base;
export type CoverRatio = '16:10' | '16:9' | '4:3' | '1:1';

const ratioValue: Record<CoverRatio, number> = {
  '16:10': 16 / 10,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
};

export interface CoverProps {
  imageUrl?: string;
  ratio?: CoverRatio;
  showScrim?: boolean;
  showDateChip?: boolean;
  dateLabel?: string;
  showBadge?: boolean;
  categoryLabel?: string;
  /** Corner radius. Defaults to 0 — the parent card usually clips the corners. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Cover({
  imageUrl,
  ratio = '16:10',
  showScrim = true,
  showDateChip = true,
  dateLabel,
  showBadge = true,
  categoryLabel,
  borderRadius = 0,
  style,
}: CoverProps) {
  const dateChip = showDateChip && dateLabel ? <Badge label={dateLabel} tone="accent" /> : null;
  const categoryBadge =
    showBadge && categoryLabel ? <Badge label={categoryLabel} tone="neutral" /> : null;

  return (
    <View style={[styles.container, { aspectRatio: ratioValue[ratio], borderRadius }, style]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={200}
        />
      ) : null}

      {showScrim ? (
        <View style={styles.scrim} pointerEvents="none">
          <Svg width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="coverScrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={SCRIM_COLOR} stopOpacity={0} />
                <Stop offset="0.6" stopColor={SCRIM_COLOR} stopOpacity={0.6} />
                <Stop offset="1" stopColor={SCRIM_COLOR} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#coverScrim)" />
          </Svg>
        </View>
      ) : null}

      {dateChip || categoryBadge ? (
        <View style={styles.overlay} pointerEvents="box-none">
          {dateChip ?? <View />}
          {categoryBadge}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: theme.colors.surface.raised,
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  overlay: {
    position: 'absolute',
    top: theme.spacing.md,
    left: theme.spacing.md,
    right: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
});
