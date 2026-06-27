import { Fragment } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  REMINDER_OPTIONS,
  useReminderOffsets,
  useRemindersEnabled,
  useSettings,
} from '@/lib/stores/settings';
import { theme } from '@/lib/theme';
import { Checkbox, Divider, Header, ListRow, Text, Toggle } from '@/ui';

// Event reminders (frame 239:1275). A master "Enable reminders" switch plus the
// multi-select default lead-times. Both persist to the settings store as the
// user's PREFERENCE only — there is NO push scheduling here. The actual
// per-event scheduling (expo-notifications) + the Supabase send-reminders wiring
// land in Phase 6; this screen just records what the user wants.
export interface RemindersScreenProps {
  onBack?: () => void;
}

export function RemindersScreen({ onBack }: RemindersScreenProps) {
  const enabled = useRemindersEnabled();
  const setEnabled = useSettings((s) => s.setRemindersEnabled);
  const selected = useReminderOffsets();
  const toggleOffset = useSettings((s) => s.toggleReminderOffset);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title="Event reminders" variant="compact" onBack={onBack} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Master switch — turns the whole feature on/off. */}
        <View style={styles.card}>
          <ListRow
            label="Enable reminders"
            description="Get a notification to never miss an event you saved to your list"
            trailing={<Toggle value={enabled} onValueChange={setEnabled} />}
          />
        </View>

        {/* Lead-time options — disabled while reminders are off. */}
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            Notify me
          </Text>
          <View style={styles.card}>
            {REMINDER_OPTIONS.map((option, index) => (
              <Fragment key={option.value}>
                {index > 0 ? <Divider /> : null}
                <Checkbox
                  label={option.label}
                  checked={selected.includes(option.value)}
                  onChange={() => toggleOffset(option.value)}
                  disabled={!enabled}
                  style={styles.option}
                />
              </Fragment>
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
  option: {
    alignSelf: 'stretch',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
});
