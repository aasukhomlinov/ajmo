import { Trash } from 'phosphor-react-native';
import { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { dateChipLabel } from '@/lib/datetime';
import { theme } from '@/lib/theme';
import type { Event } from '@/lib/types';

import { EventRow } from '../discover/EventRow';

// Saved-list row = the shared EventRow wrapped in a swipe-to-delete gesture.
// Swiping LEFT reveals a destructive red action (status/error + Phosphor Trash);
// completing the swipe — or tapping the revealed action — unsaves the event via
// the shared store, which reactively drops the row from the list. The swipe lives
// HERE, at the Saved-screen level only: the EventRow primitive stays a plain row
// everywhere else (feed card, search results), so the static design still matches
// frame 160:221. Tapping the row (no horizontal drag) still navigates — the pan
// gesture only activates on a horizontal swipe, so it doesn't fight the row's tap.
const ACTION_WIDTH = 88;
const TRASH_SIZE = 24;

export interface SavedRowProps {
  event: Event;
  onPress: () => void;
  /** Remove the event from saved (toggleSave on the shared store). */
  onDelete: () => void;
}

export function SavedRow({ event, onPress, onDelete }: SavedRowProps) {
  const renderRightActions = useCallback(
    (progress: SharedValue<number>) => (
      <DeleteAction progress={progress} label={event.title} onPress={onDelete} />
    ),
    [event.title, onDelete],
  );

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={ACTION_WIDTH / 2}
      overshootRight={false}
      renderRightActions={renderRightActions}
      onSwipeableOpen={onDelete}
    >
      <EventRow
        title={event.title}
        venue={event.venue.name}
        date={dateChipLabel(event.starts_at)}
        imageUrl={event.cover_url}
        onPress={onPress}
      />
    </ReanimatedSwipeable>
  );
}

// The revealed destructive affordance. Fills the row height (the actions
// container is absolute-fill with stretch); the glyph scales/fades in with the
// swipe progress.
function DeleteAction({
  progress,
  label,
  onPress,
}: {
  progress: SharedValue<number>;
  label: string;
  onPress: () => void;
}) {
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <Pressable
      style={styles.action}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Remove ${label} from saved`}
    >
      <Reanimated.View style={iconStyle}>
        <Trash size={TRASH_SIZE} color={theme.colors.text.primary} weight="bold" />
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.error,
    borderTopRightRadius: theme.radii.md,
    borderBottomRightRadius: theme.radii.md,
  },
});
