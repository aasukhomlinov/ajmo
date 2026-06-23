import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '@/lib/theme';
import { Checkbox, Header, Text, Toggle } from '@/ui';

// Lead-time options for an event reminder. Multi-select: a user can be
// reminded at several of these offsets before the same event.
export type ReminderOffset = '1_week' | '2_days' | '1_day' | 'day_of';

const REMINDER_OPTIONS: { value: ReminderOffset; label: string }[] = [
  { value: '1_week', label: 'One week before' },
  { value: '2_days', label: 'Two days before' },
  { value: '1_day', label: 'One day before' },
  { value: 'day_of', label: 'On the day of the event' },
];

export interface RemindersScreenProps {
  onBack?: () => void;
}

export function RemindersScreen({ onBack }: RemindersScreenProps) {
  // Local state for now — wire to user-scoped persistence (Supabase) later.
  const [enabled, setEnabled] = useState(true);
  const [selected, setSelected] = useState<ReminderOffset[]>(['1_day']);

  const toggleOffset = (value: ReminderOffset) => {
    setSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Event reminders" variant="compact" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Master switch — turns the whole feature on/off. */}
        <View style={styles.card}>
          <View style={styles.masterText}>
            <Text variant="body">Enable reminders</Text>
            <Text variant="bodySmall" color={theme.colors.text.secondary}>
              Get a notification before events you're going to.
            </Text>
          </View>
          <Toggle value={enabled} onValueChange={setEnabled} />
        </View>

        {/* Lead-time options — disabled while reminders are off. */}
        <View style={styles.section}>
          <Text
            variant="caption"
            color={theme.colors.text.secondary}
            style={styles.sectionLabel}
          >
            Notify me before
          </Text>

          <View style={[styles.card, styles.optionsCard]}>
            {REMINDER_OPTIONS.map((option, index) => (
              <View
                key={option.value}
                style={[styles.optionRow, index > 0 && styles.optionDivider]}
              >
                <Text
                  variant="body"
                  color={
                    enabled ? theme.colors.text.primary : theme.colors.text.disabled
                  }
                >
                  {option.label}
                </Text>
                <Checkbox
                  checked={selected.includes(option.value)}
                  onChange={() => toggleOffset(option.value)}
                  disabled={!enabled}
                />
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface.base,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
  },
  masterText: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  section: {
    gap: theme.spacing.sm,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    paddingHorizontal: theme.spacing.xs,
  },
  optionsCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingVertical: 0,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    paddingVertical: theme.spacing.lg,
  },
  optionDivider: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
});
