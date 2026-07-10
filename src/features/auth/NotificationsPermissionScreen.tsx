import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Bell } from 'phosphor-react-native';
import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/stores/auth';
import { useSettings } from '@/lib/stores/settings';
import { theme } from '@/lib/theme';

import { AuthConfirmation } from './AuthConfirmation';

// Permission · Notifications (frame 253:1322) — the final onboarding step after
// the city picker. "Turn on" raises the OS permission prompt; either choice
// finishes onboarding (completeOnboarding flips the root gate, which redirects
// into the tabs). The push preference persists to the user's profile via the
// settings mirror; actual token registration/scheduling is a later phase.
export function NotificationsPermissionScreen() {
  const t = useT();
  const router = useRouter();
  const completeOnboarding = useAuth((s) => s.completeOnboarding);
  const setPushEnabled = useSettings((s) => s.setPushEnabled);
  const [requesting, setRequesting] = useState(false);

  const finish = () => {
    completeOnboarding();
    router.replace('/discover');
  };

  const enable = async () => {
    setRequesting(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      setPushEnabled(status === 'granted');
    } catch {
      setPushEnabled(false);
    }
    setRequesting(false);
    finish();
  };

  const skip = () => {
    setPushEnabled(false);
    finish();
  };

  return (
    <AuthConfirmation
      icon={<Bell size={52} color={theme.colors.accent.base} />}
      title={t('onboarding.notificationsTitle')}
      body={t('onboarding.notificationsBody')}
      primaryLabel={t('onboarding.notificationsCta')}
      onPrimary={() => void enable()}
      primaryDisabled={requesting}
      secondaryLabel={t('onboarding.notificationsSkip')}
      onSecondary={skip}
      onBack={router.canGoBack() ? () => router.back() : undefined}
    />
  );
}
