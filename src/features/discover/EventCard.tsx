import { Check, Clock, MapPin, Plus, Ticket } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { Cover } from '@/ui/Cover';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

// Event feed card — composes Cover (16:10, lime date Badge + neutral category
// Badge) + Phosphor meta icons. The body overlaps the cover by 28px so the wide
// title reads over the scrim. A single save control (per CLAUDE.md: one "+"
// bookmark, no "going"/"like") sits beside the title: outline Plus by default,
// lime-filled Check once saved.
const TITLE_OVERLAP = 28;
const META_ICON_SIZE = 16;
const SAVE_ICON_SIZE = 24;

export interface EventCardProps {
  title: string;
  venue: string;
  time: string;
  price: string;
  dateLabel?: string;
  category?: string;
  imageUrl?: string;
  saved?: boolean;
  onPress?: () => void;
  onToggleSave?: () => void;
}

export function EventCard({
  title,
  venue,
  time,
  price,
  dateLabel,
  category,
  imageUrl,
  saved = false,
  onPress,
  onToggleSave,
}: EventCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      <Cover
        imageUrl={imageUrl}
        ratio="16:10"
        dateLabel={dateLabel}
        categoryLabel={category}
        style={styles.cover}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="h1" style={styles.flex} numberOfLines={2}>
            {title}
          </Text>
          <IconButton
            icon={
              saved ? (
                <Check size={SAVE_ICON_SIZE} weight="bold" color={theme.colors.text.onAccent} />
              ) : (
                <Plus size={SAVE_ICON_SIZE} color={theme.colors.text.primary} />
              )
            }
            variant="surface"
            onPress={onToggleSave}
            accessibilityLabel={saved ? 'Saved — tap to remove' : 'Save event'}
            style={saved ? styles.saveActive : undefined}
          />
        </View>

        <View style={styles.row}>
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

        <View style={styles.meta}>
          <View style={styles.row}>
            <Clock size={META_ICON_SIZE} color={theme.colors.text.secondary} />
            <Text variant="bodySmall" color={theme.colors.text.secondary}>
              {time}
            </Text>
          </View>
          <View style={styles.row}>
            <Ticket size={META_ICON_SIZE} color={theme.colors.text.secondary} />
            <Text variant="bodySmall" color={theme.colors.text.primary}>
              {price}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  cover: {
    marginBottom: -TITLE_OVERLAP,
  },
  body: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  saveActive: {
    backgroundColor: theme.colors.accent.base,
    borderColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
});
