import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import type { EventCategory } from '@/lib/types';
import { BottomSheet, Button, Chip, Text } from '@/ui';

import { CATEGORY_META, CATEGORY_ORDER } from './categories';

// Categories filter sheet (frame node 177:1031): a wrapping grid of multi-select
// category Chips with a Reset / Apply footer. Selection is staged locally and
// committed to the feed only on Apply.
export interface CategoryFilterSheetProps {
  visible: boolean;
  selected: EventCategory[];
  onApply: (categories: EventCategory[]) => void;
  onClose: () => void;
}

export function CategoryFilterSheet({
  visible,
  selected,
  onApply,
  onClose,
}: CategoryFilterSheetProps) {
  const t = useT();
  const [draft, setDraft] = useState<EventCategory[]>(selected);

  // Re-sync the draft to the applied selection whenever the sheet opens, so
  // edits abandoned by a scrim-dismiss don't carry into the next open.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(selected);
  }

  const toggle = (category: EventCategory) =>
    setDraft((d) => (d.includes(category) ? d.filter((c) => c !== category) : [...d, category]));

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('common.filters')}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('common.reset')}
            type="secondary"
            style={styles.button}
            onPress={() => setDraft([])}
          />
          <Button label={t('common.apply')} type="primary" style={styles.button} onPress={apply} />
        </View>
      }
    >
      <View style={styles.section}>
        <Text variant="caption" color={theme.colors.text.secondary} style={styles.label}>
          {t('filters.categoriesSection')}
        </Text>
        <View style={styles.chips}>
          {CATEGORY_ORDER.map((category) => (
            <Chip
              key={category}
              label={t(CATEGORY_META[category].labelKey)}
              leftIcon={CATEGORY_META[category].icon}
              active={draft.includes(category)}
              onPress={() => toggle(category)}
            />
          ))}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.md,
  },
  label: {
    textTransform: 'uppercase',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  button: {
    flex: 1,
  },
});
