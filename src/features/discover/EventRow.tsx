import { MapPin } from 'phosphor-react-native';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '@/lib/theme';
import { Badge, type BadgeTone } from '@/ui/Badge';
import { Cover } from '@/ui/Cover';
import { Text } from '@/ui/Text';

// Compact event row — saved list, search results, map callout. 88px 1:1 Cover
// thumb (overlays off) + date/title/venue + optional status Badge.
const THUMB_SIZE = 88;
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
      <Cover
        imageUrl={imageUrl}
        ratio="1:1"
        showScrim={false}
        showDateChip={false}
        showBadge={false}
        borderRadius={theme.radii.lg}
        style={styles.thumb}
      />

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
    gap: theme.spacing.md,
    alignItems: 'flex-start',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
  },
  thumb: {
    width: THUMB_SIZE,
  },
  info: {
    flex: 1,
    gap: theme.spacing.xs,
    alignItems: 'flex-start',
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
