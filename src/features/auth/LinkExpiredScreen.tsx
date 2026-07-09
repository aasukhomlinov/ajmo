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
// carries an error (consumed / expired / invalid link — the fallback path;
// codes are primary). "Send a fresh code" resends to the address we still
// have and lands on the code-entry screen; after a cold start the email is
// gone (in-memory only), so both actions fall back to the email screen.
export function LinkExpiredScreen() {
  const t = useT();
  const router = useRouter();
  const lastEmail = useAuth((s) => s.lastEmail);
  const sendCode = useAuth((s) => s.sendCode);
  const { toast, showToast } = useTransientToast();
  const [sending, setSending] = useState(false);

  const sendFresh = async () => {
    if (!lastEmail) {
      router.replace('/email');
      return;
    }
    setSending(true);
    const error = await sendCode(lastEmail);
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
