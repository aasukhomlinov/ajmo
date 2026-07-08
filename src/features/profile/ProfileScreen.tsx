import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_VERSION_LABEL } from '@/lib/appInfo';
import { useT } from '@/lib/i18n';
import { languageName, useLanguage, usePushEnabled, useSettings } from '@/lib/stores/settings';
import { theme } from '@/lib/theme';
import { Divider, Header, ListRow, Text, Toggle } from '@/ui';

// Profile tab = the settings hub (frame 196:1111). A stack of grouped cards that
// either toggle a local preference or navigate to a sub-screen. There is NO
// account/auth block in v1 (auth is a later phase) — the frame draws none, so
// neither does this. Push/reminder switches and the language preference are
// stored locally only (see the settings store); the Privacy/Terms rows open
// external links. Navigation to the sub-screens is injected by the route.
export interface ProfileScreenProps {
  onOpenLanguage?: () => void;
  onOpenReminders?: () => void;
  onOpenAbout?: () => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export function ProfileScreen({
  onOpenLanguage,
  onOpenReminders,
  onOpenAbout,
  onOpenPrivacy,
  onOpenTerms,
}: ProfileScreenProps) {
  const t = useT();
  const pushEnabled = usePushEnabled();
  const setPushEnabled = useSettings((s) => s.setPushEnabled);
  const language = useLanguage();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={t('profile.title')} variant="large" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Notifications — master push switch + a route into per-event lead-times. */}
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            {t('profile.notifications')}
          </Text>
          <View style={styles.card}>
            <ListRow
              label={t('profile.pushNotifications')}
              trailing={<Toggle value={pushEnabled} onValueChange={setPushEnabled} />}
            />
            <Divider />
            <ListRow label={t('profile.eventReminders')} onPress={onOpenReminders} />
          </View>
        </View>

        {/* Language — current choice shown as the subtitle; opens the picker. */}
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            {t('profile.language')}
          </Text>
          <View style={styles.card}>
            <ListRow
              label={t('profile.language')}
              description={languageName(language)}
              onPress={onOpenLanguage}
            />
          </View>
        </View>

        {/* About — in-app screen + external legal links. */}
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            {t('profile.aboutSection')}
          </Text>
          <View style={styles.card}>
            <ListRow label={t('profile.aboutAjmo')} onPress={onOpenAbout} />
            <Divider />
            <ListRow label={t('profile.privacy')} onPress={onOpenPrivacy} />
            <Divider />
            <ListRow label={t('profile.terms')} onPress={onOpenTerms} />
          </View>
        </View>

        <Text variant="bodySmall" color={theme.colors.text.secondary} style={styles.version}>
          {`ajmo · ${APP_VERSION_LABEL}`}
        </Text>
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
  version: {
    textAlign: 'center',
    paddingTop: theme.spacing.xs,
  },
});
