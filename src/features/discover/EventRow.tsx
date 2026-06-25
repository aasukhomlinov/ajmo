import { Image } from 'expo-image';
import { MapPin } from 'phosphor-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Text } from '@/ui/Text';

// Compact event row — saved list, search results, map callout (DS node 210:1992).
// A flush 94px-wide thumbnail bleeding to the row's top/bottom/left edges (rounded
// only on the left to follow the row corner, no inset), then date/title/venue +
// optional status Badge. The row clips its children so the thumb's right edge sits
// square against the text block while the outer corners stay rounded.
const THUMB_WIDTH = 94;
const META_ICON_SIZE = 16;

export interface EventRowBadge {
  label: string;
  tone?: BadgeTone;
}

export interface EventRowProps {
  title: string;
  venue: string;
  date: string;
  imageUrl?: string;
  badge?: EventRowBadge;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EventRow({ title, venue, date, imageUrl, badge, onPress, style }: EventRowProps) {
  return (
    <Pressable style={[styles.row, style]} onPress={onPress} accessibilityRole="button">
      <View style={styles.thumb}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.thumbImage}
            contentFit="cover"
            transition={200}
          />
        ) : null}
      </View>

      <View style={styles.info}>
        <Text variant="caption" color={theme.colors.accent.base} style={styles.date} numberOfLines={1}>
          {date}
        </Text>
        <Text variant="h2" numberOfLines={2}>
          {title}
        </Text>
        <View style={styles.venue}>
          <MapPin size={META_ICON_SIZE} color={theme.colors.text.secondary} />
          <Text
            variant="bodySmall"
            color={theme.colors.text.secondary}
            style={styles.flex}
            numberOfLines={1}
          >
            {venue}
          </Text>
        </View>
        {badge ? <Badge label={badge.label} tone={badge.tone ?? 'success'} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
  thumb: {
    width: THUMB_WIDTH,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.surface.raised,
    borderTopLeftRadius: theme.radii.md,
    borderBottomLeftRadius: theme.radii.md,
  },
  thumbImage: {
    flex: 1,
  },
  info: {
    flex: 1,
    gap: theme.spacing.xs,
    alignItems: 'flex-start',
    padding: theme.spacing.md,
  },
  date: {
    textTransform: 'uppercase',
  },
  venue: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  flex: {
    flex: 1,
  },
});
