import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { EnvelopeSimple } from 'phosphor-react-native';
import { useState } from 'react';
import { Platform } from 'react-native';

import { useT } from '@/lib/i18n';
import { richTemplate } from '@/lib/i18n/rich';
import { useAuth } from '@/lib/stores/auth';
import { theme } from '@/lib/theme';
import { Text, Toast } from '@/ui';

import { AuthConfirmation } from './AuthConfirmation';
import { useTransientToast } from './useTransientToast';

// Auth · Email Sent (frame 221:1316) — "check your inbox" confirmation with the
// entered address highlighted. Primary opens the mail app (iOS `message://`
// scheme; Android has no inbox scheme, so resend is promoted to primary there).
export function EmailSentScreen() {
  const t = useT();
  const router = useRouter();
  const lastEmail = useAuth((s) => s.lastEmail);
  const sendMagicLink = useAuth((s) => s.sendMagicLink);
  const { toast, showToast } = useTransientToast();
  const [resending, setResending] = useState(false);

  const resend = async () => {
    if (!lastEmail) {
      router.replace('/email');
      return;
    }
    setResending(true);
    const error = await sendMagicLink(lastEmail);
    setResending(false);
    showToast(error ? t('auth.sendFailed') : t('auth.resent'), error ? 'error' : 'success');
  };

  const openEmailApp = () => {
    Linking.openURL('message://').catch(() => {});
  };

  const body = richTemplate(t('auth.sentBody'), {
    email: (
      <Text variant="body" color={theme.colors.text.primary}>
        {lastEmail ?? ''}
      </Text>
    ),
  });

  const canOpenMailApp = Platform.OS === 'ios';

  return (
    <AuthConfirmation
      icon={<EnvelopeSimple size={52} color={theme.colors.accent.base} />}
      title={t('auth.sentTitle')}
      body={body}
      primaryLabel={canOpenMailApp ? t('auth.openEmailApp') : t('auth.resend')}
      onPrimary={canOpenMailApp ? openEmailApp : () => void resend()}
      primaryDisabled={!canOpenMailApp && resending}
      secondaryLabel={canOpenMailApp ? t('auth.resend') : undefined}
      onSecondary={canOpenMailApp ? () => void resend() : undefined}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/email'))}
      overlay={toast ? <Toast message={toast.message} tone={toast.tone} /> : null}
    />
  );
}
