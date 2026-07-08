import { Check, MagnifyingGlass } from 'phosphor-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CITIES } from '@/lib/cities';
import { useT } from '@/lib/i18n';
import { useActiveCity, useSetCity } from '@/lib/stores/city';
import { theme } from '@/lib/theme';
import type { CityId } from '@/lib/types';
import { Divider, Input, ListRow, Text } from '@/ui';

// Shared body of the city picker — used by BOTH entry points: the in-app /city
// route (opened from the Discover header) and the onboarding "What's your
// location?" step. The surrounding chrome differs (compact header vs. H1 +
// Continue CTA), but the list + selection logic here is identical: each row
// reads the active city from the store and writes it on tap. NO "detect
// automatically" affordance — manual selection only (CLAUDE.md, no geolocation).
// Matches frames 275:1451 (in-app) / 284:1496 (onboarding).

const CHECK_SIZE = 20;

export interface CityPickerProps {
  /** Show the "Search cities" field above the list (in-app variant only). */
  searchable?: boolean;
  /** Screen-specific follow-up after the store is written (e.g. close the route). */
  onSelect?: (city: CityId) => void;
}

export function CityPicker({ searchable = false, onSelect }: CityPickerProps) {
  const t = useT();
  const activeCity = useActiveCity();
  const setCity = useSetCity();
  const [query, setQuery] = useState('');

  // Filter over the LOCALIZED names so typing "бел"/"beo" works per language.
  const cities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const localized = CITIES.map((c) => ({ id: c.id, name: t(c.nameKey) }));
    return q ? localized.filter((c) => c.name.toLowerCase().includes(q)) : localized;
  }, [query, t]);

  const handleSelect = (city: CityId) => {
    setCity(city);
    onSelect?.(city);
  };

  return (
    <View style={styles.container}>
      {searchable ? (
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t('city.searchPlaceholder')}
          leftIcon={<MagnifyingGlass size={20} color={theme.colors.text.secondary} />}
        />
      ) : null}

      <View style={styles.section}>
        <Text variant="sectionHeader" color={theme.colors.text.secondary}>
          {t('city.sectionTitle')}
        </Text>
        <View style={styles.card}>
          {cities.map((city, index) => (
            <View key={city.id}>
              {index > 0 ? <Divider /> : null}
              <ListRow
                label={city.name}
                onPress={() => handleSelect(city.id)}
                showChevron={false}
                trailing={
                  city.id === activeCity ? (
                    <Check size={CHECK_SIZE} color={theme.colors.accent.base} />
                  ) : undefined
                }
              />
            </View>
          ))}
        </View>
      </View>

      <Text variant="bodySmall" color={theme.colors.text.secondary}>
        {t('city.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.sm,
  },
  card: {
    backgroundColor: theme.colors.surface.base,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    overflow: 'hidden',
  },
});
