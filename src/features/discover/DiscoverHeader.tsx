import { MagnifyingGlass, MapPin } from 'phosphor-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { IconButton, Logo, Text } from '@/ui';

// Discover app bar (frame node 177:843): the ajmo wordmark (left), a city pill
// that routes to the city picker, and a search button that routes to search.
// Fixed above the scrolling feed — it does not scroll with the list. The logo is
// the DS Logo vector (Small variant, 98×33) tinted to the accent token.

export interface DiscoverHeaderProps {
  cityLabel: string;
  onCityPress?: () => void;
  onSearchPress?: () => void;
}

export function DiscoverHeader({ cityLabel, onCityPress, onSearchPress }: DiscoverHeaderProps) {
  return (
    <View style={styles.header}>
      <Logo />

      <View style={styles.actions}>
        <Pressable
          onPress={onCityPress}
          accessibilityRole="button"
          accessibilityLabel={`Change city — ${cityLabel}`}
          style={styles.city}
        >
          <MapPin size={20} color={theme.colors.accent.base} />
          <Text variant="button" color={theme.colors.accent.base}>
            {cityLabel}
          </Text>
        </Pressable>

        <IconButton
          icon={<MagnifyingGlass size={24} color={theme.colors.text.primary} />}
          variant="surface"
          onPress={onSearchPress}
          accessibilityLabel="Search events"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  city: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radii.md,
  },
});
