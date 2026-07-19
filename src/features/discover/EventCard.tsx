import { Check, Clock, MapPin, Plus, Ticket } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { Cover } from '@/ui/Cover';
import { IconButton } from '@/ui/IconButton';
import { Text } from '@/ui/Text';

// Event feed card — composes Cover (16:10, lime date Badge + neutral category
// Badge) + Phosphor meta icons. The body overlaps the cover by 28px so the wide
// title reads over the scrim. Below the title: an info column (meta time·price
// over the venue line) with a single save control pinned to its bottom-right
// corner — per CLAUDE.md one "+" bookmark, no "going"/"like": outline Plus by
// default, lime-filled Check once saved. Layout matches app frame node 177:837.
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
  const t = useT();
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
        <Text variant="h1" style={styles.title} numberOfLines={2}>
          {title}
        </Text>

        <View style={styles.row}>
          <View style={styles.info}>
            <View style={styles.meta}>
              <View style={styles.metaItem}>
                <Clock size={META_ICON_SIZE} color={theme.colors.text.secondary} />
                <Text variant="bodySmall" color={theme.colors.text.secondary}>
                  {time}
                </Text>
              </View>
              {price ? (
                <View style={styles.metaItem}>
                  <Ticket size={META_ICON_SIZE} color={theme.colors.text.secondary} />
                  <Text variant="bodySmall" color={theme.colors.text.secondary}>
                    {price}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.metaItem}>
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
          </View>

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
            accessibilityLabel={saved ? t('event.savedA11y') : t('event.saveA11y')}
            style={saved ? styles.saveActive : undefined}
          />
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
  title: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
  },
  info: {
    flex: 1,
    gap: theme.spacing.sm,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  flex: {
    flex: 1,
  },
  saveActive: {
    backgroundColor: theme.colors.accent.base,
    borderColor: 'transparent',
  },
});
