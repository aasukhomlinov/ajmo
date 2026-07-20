import { useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_VERSION_LABEL } from '@/lib/appInfo';
import { useT } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import {
  ensureNotificationsPermission,
  useNotificationsGranted,
} from '@/lib/notifications/permissions';
import { useAuth, useUserEmail } from '@/lib/stores/auth';
import { languageName, useLanguage, usePushEnabled, useSettings } from '@/lib/stores/settings';
import { theme } from '@/lib/theme';
import { Divider, Header, ListRow, Text, Toggle } from '@/ui';

// Profile tab = the settings hub (frame 196:1111). A stack of grouped cards that
// either toggle a local preference or navigate to a sub-screen. Push/reminder
// switches and the language preference are stored locally only (see the settings
// store); the Privacy/Terms rows open external links. Navigation to the
// sub-screens is injected by the route. The Account section (auth phase) shows
// the signed-in address + Sign out — ending the session flips the root gate
// back to the auth flow, no navigation needed here.
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
  const email = useUserEmail();
  const signOut = useAuth((s) => s.signOut);
  const granted = useNotificationsGranted();

  // Preference ON but the OS says no → surface it passively (no nagging): a
  // status line under the switch; tapping the row opens system settings.
  const systemBlocked = pushEnabled && granted === false;

  const togglePush = (enabled: boolean) => {
    setPushEnabled(enabled);
    // "Ask later" users get the OS prompt on re-enable; a hard denial is not
    // re-promptable — the status line + settings link covers that path.
    if (enabled) void ensureNotificationsPermission();
  };

  // Signing back in costs a fresh magic-link round trip — confirm first.
  const confirmSignOut = () => {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Account deletion (Meta App Review + /data-deletion promise). The server
  // (delete-account edge function) derives the user from the JWT and cascades
  // profile/saves/reminders off the auth user. Two explicit destructive
  // confirms before anything happens; failure surfaces an alert with retry.
  const [deleting, setDeleting] = useState(false);

  const runDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.functions.invoke('delete-account');
    setDeleting(false);
    if (error) {
      Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountFailed'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.retry'), onPress: () => void runDeleteAccount() },
      ]);
      return;
    }
    // Server session is already gone; signOut falls back to local scope and
    // flips the root gate to the auth flow. The native alert survives that.
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountDone'));
    await signOut();
  };

  const confirmDeleteAccount = () => {
    Alert.alert(t('profile.deleteAccount'), t('profile.deleteAccountBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.deleteAccount'),
        style: 'destructive',
        onPress: () =>
          Alert.alert(
            t('profile.deleteAccountConfirmTitle'),
            t('profile.deleteAccountConfirmBody'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('profile.deleteAccountConfirmCta'),
                style: 'destructive',
                onPress: () => void runDeleteAccount(),
              },
            ],
          ),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Header title={t('profile.title')} variant="large" />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Account — signed-in address + sign out (the hard gate handles the rest). */}
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            {t('profile.account')}
          </Text>
          <View style={styles.card}>
            {email ? <ListRow label={email} /> : null}
            {email ? <Divider /> : null}
            <ListRow label={t('profile.signOut')} onPress={confirmSignOut} showChevron={false} />
          </View>
          {/* Destructive zone — its own card so it can't be fat-fingered from
              the benign rows above. Deletion itself is double-confirmed. */}
          <View style={styles.card}>
            <ListRow
              label={t('profile.deleteAccount')}
              destructive
              disabled={deleting}
              onPress={confirmDeleteAccount}
              showChevron={false}
            />
          </View>
        </View>

        {/* Notifications — master push switch + a route into per-event lead-times. */}
        <View style={styles.section}>
          <Text variant="sectionHeader" color={theme.colors.text.secondary}>
            {t('profile.notifications')}
          </Text>
          <View style={styles.card}>
            <ListRow
              label={t('profile.pushNotifications')}
              description={systemBlocked ? t('profile.pushSystemOff') : undefined}
              onPress={systemBlocked ? () => void Linking.openSettings() : undefined}
              showChevron={false}
              trailing={<Toggle value={pushEnabled} onValueChange={togglePush} />}
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
