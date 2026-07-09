import { useRouter } from 'expo-router';
import { WarningCircle } from 'phosphor-react-native';
import { useState } from 'react';

import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/stores/auth';
import { theme } from '@/lib/theme';
import { Toast } from '@/ui';

import { AuthConfirmation } from './AuthConfirmation';
import { useTransientToast } from './useTransientToast';

// Auth · Link expired (frame 274:1430) — shown when a magic-link callback
// carries an error (consumed / expired / invalid link). "Send a new link"
// resends to the address we still have; after a cold start it's gone (the
// email lives only in memory), so both actions fall back to the email screen.
export function LinkExpiredScreen() {
  const t = useT();
  const router = useRouter();
  const lastEmail = useAuth((s) => s.lastEmail);
  const sendMagicLink = useAuth((s) => s.sendMagicLink);
  const { toast, showToast } = useTransientToast();
  const [sending, setSending] = useState(false);

  const sendFresh = async () => {
    if (!lastEmail) {
      router.replace('/email');
      return;
    }
    setSending(true);
    const error = await sendMagicLink(lastEmail);
    setSending(false);
    if (error) {
      showToast(t('auth.sendFailed'), 'error');
      return;
    }
    router.replace('/sent');
  };

  return (
    <AuthConfirmation
      icon={<WarningCircle size={52} color={theme.colors.error} />}
      title={t('auth.expiredTitle')}
      body={t('auth.expiredBody')}
      primaryLabel={t('auth.sendNew')}
      onPrimary={() => void sendFresh()}
      primaryDisabled={sending}
      secondaryLabel={t('auth.useDifferentEmail')}
      onSecondary={() => router.replace('/email')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/welcome'))}
      overlay={toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    />
  );
}
