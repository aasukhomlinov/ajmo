import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { BottomSheet, Radio, Text } from '@/ui';

import { DATE_OPTION_KEYS, DATE_OPTION_ORDER, type DateFilter } from './useDiscoverFeed';

// Date filter sheet (frame node 178:724): a single-select "When" radio list of
// presets. Tapping an option applies it immediately and dismisses the sheet
// (no Apply footer); "Any Time" is the built-in clear. Closing without a tap
// keeps the current filter.
export interface DateFilterSheetProps {
  visible: boolean;
  selected: DateFilter;
  onApply: (date: DateFilter) => void;
  onClose: () => void;
}

export function DateFilterSheet({ visible, selected, onApply, onClose }: DateFilterSheetProps) {
  const t = useT();

  const select = (option: DateFilter) => {
    onApply(option);
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('common.filters')}>
      <View style={styles.section}>
        <Text variant="caption" color={theme.colors.text.secondary} style={styles.label}>
          {t('filters.when')}
        </Text>
        <View style={styles.options}>
          {DATE_OPTION_ORDER.map((option) => (
            <Radio
              key={option}
              label={t(DATE_OPTION_KEYS[option])}
              checked={selected === option}
              onChange={() => select(option)}
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
