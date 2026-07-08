import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { BottomSheet, Button, Radio, Text } from '@/ui';

import { DATE_OPTION_KEYS, DATE_OPTION_ORDER, type DateFilter } from './useDiscoverFeed';

// Date filter sheet (frame node 178:724): a single-select "When" radio list of
// presets with an Apply footer. "Any Time" is the built-in clear, so there is no
// separate Reset. Selection is staged locally and committed on Apply.
export interface DateFilterSheetProps {
  visible: boolean;
  selected: DateFilter;
  onApply: (date: DateFilter) => void;
  onClose: () => void;
}

export function DateFilterSheet({ visible, selected, onApply, onClose }: DateFilterSheetProps) {
  const t = useT();
  const [draft, setDraft] = useState<DateFilter>(selected);

  // Re-sync the draft to the applied value whenever the sheet opens, so a
  // scrim-dismissed change doesn't carry into the next open.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(selected);
  }

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={t('common.filters')}
      footer={<Button label={t('common.apply')} type="primary" fullWidth onPress={apply} />}
    >
      <View style={styles.section}>
        <Text variant="caption" color={theme.colors.text.secondary} style={styles.label}>
          {t('filters.when')}
        </Text>
        <View style={styles.options}>
          {DATE_OPTION_ORDER.map((option) => (
            <Radio
              key={option}
              label={t(DATE_OPTION_KEYS[option])}
              checked={draft === option}
              onChange={() => setDraft(option)}
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
  options: {
    gap: theme.spacing.md,
  },
});
