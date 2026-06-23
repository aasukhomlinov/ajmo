import { Clock, MapPin, Ticket } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { Button } from '@/ui/Button';
import { Cover } from '@/ui/Cover';
import { Text } from '@/ui/Text';

// Event feed card — composes Cover (16:10, lime date Badge + neutral category
// Badge) + Phosphor meta icons + a full-width Button CTA. The body overlaps the
// cover by 28px so the title reads over the scrim. State: Default (Secondary
// "I'm going") / Going (Primary lime "Going").
const TITLE_OVERLAP = 28;
const META_ICON_SIZE = 16;

export type EventCardState = 'default' | 'going';

export interface EventCardProps {
  title: string;
  venue: string;
  time: string;
  price: string;
  dateLabel?: string;
  category?: string;
  imageUrl?: string;
  state?: EventCardState;
  onPress?: () => void;
  onToggleGoing?: () => void;
}

export function EventCard({
  title,
  venue,
  time,
  price,
  dateLabel,
  category,
  imageUrl,
  state = 'default',
  onPress,
  onToggleGoing,
}: EventCardProps) {
  const going = state === 'going';

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
        <View style={styles.content}>
          <Text variant="h1" numberOfLines={2}>
            {title}
          </Text>

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

        <View style={styles.footer}>
          <Button
            label={going ? 'GOING' : "I'M GOING"}
            type={going ? 'primary' : 'secondary'}
            fullWidth
            onPress={onToggleGoing}
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
    width: '100%',
  },
  content: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
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
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.lg,
  },
});
