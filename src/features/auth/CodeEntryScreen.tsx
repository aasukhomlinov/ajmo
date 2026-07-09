import { useRouter } from 'expo-router';
import { ArrowLeft, EnvelopeSimple } from 'phosphor-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { richTemplate } from '@/lib/i18n/rich';
import { useAuth } from '@/lib/stores/auth';
import { theme } from '@/lib/theme';
import { Button, CodeInput, IconButton, Screen, Text, Toast } from '@/ui';

import { useTransientToast } from './useTransientToast';

// Auth · Enter code — replaces the old "check your inbox" magic-link wait
// screen (frame 221:1316): the sign-in email now leads with a 6-digit code,
// entered right here. Composed from existing primitives + CodeInput (no
// dedicated Figma frame). A full code auto-verifies; wrong/expired codes clear
// the cells and flag them with the error border. Resend is throttled by a
// local cooldown on top of Supabase's server-side rate limit. On success the
// root gate sees signedIn and swaps the (auth) stack out — no navigation here.
const CODE_LENGTH = 6;
const RESEND_COOLDOWN_S = 45;
const BADGE_SIZE = 104;

export function CodeEntryScreen() {
  const t = useT();
  const router = useRouter();
  const lastEmail = useAuth((s) => s.lastEmail);
  const sendCode = useAuth((s) => s.sendCode);
  const verifyCode = useAuth((s) => s.verifyCode);
  const { toast, showToast } = useTransientToast();

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [wrongCode, setWrongCode] = useState(false);
  const [resending, setResending] = useState(false);
  // A code was just sent to land on this screen, so start cooled down.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  const coolingDown = cooldown > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);

  const verify = async (candidate: string) => {
    if (!lastEmail) {
      // Cold start / store lost — the email only lives in memory.
      router.replace('/email');
      return;
    }
    setVerifying(true);
    const error = await verifyCode(lastEmail, candidate);
    if (error) {
      // GoTrue reports wrong and expired codes identically — one retry UX.
      setCode('');
      setWrongCode(true);
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (!lastEmail) {
      router.replace('/email');
      return;
    }
    setResending(true);
    const error = await sendCode(lastEmail);
    setResending(false);
    showToast(error ? t('auth.sendFailed') : t('auth.resent'), error ? 'error' : 'success');
    if (!error) {
      // The fresh code invalidates the old one — reset for a clean entry.
      setCode('');
      setWrongCode(false);
      setCooldown(RESEND_COOLDOWN_S);
    }
  };

  const body = richTemplate(t('auth.codeBody'), {
    email: (
      <Text variant="body" color={theme.colors.text.primary}>
        {lastEmail ?? ''}
      </Text>
    ),
  });

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton
          icon={<ArrowLeft size={24} color={theme.colors.text.primary} />}
          variant="ghost"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/email'))}
          accessibilityLabel={t('common.goBack')}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.badge}>
          <EnvelopeSimple size={52} color={theme.colors.accent.base} />
        </View>
        <Text variant="h1" style={styles.centeredText}>
          {t('auth.codeTitle')}
        </Text>
        <Text variant="body" color={theme.colors.text.secondary} style={styles.centeredText}>
          {body}
        </Text>

        <CodeInput
          value={code}
          onChange={(next) => {
            setCode(next);
            if (wrongCode) setWrongCode(false);
          }}
          onComplete={(full) => void verify(full)}
          error={wrongCode}
          autoFocus
          accessibilityLabel={t('auth.codeTitle')}
          style={styles.code}
        />
        {wrongCode ? (
          <Text variant="bodySmall" color={theme.colors.error} style={styles.centeredText}>
            {t('auth.codeInvalid')}
          </Text>
        ) : null}

        <Button
          label={t('auth.verify')}
          fullWidth
          disabled={verifying || code.length < CODE_LENGTH}
          onPress={() => void verify(code)}
        />
        <Button
          label={coolingDown ? t('auth.resendIn', { seconds: cooldown }) : t('auth.resendCode')}
          type="text"
          disabled={coolingDown || resending}
          onPress={() => void resend()}
        />
      </View>

      {toast ? (
        <View style={styles.overlay} pointerEvents="box-none">
          <Toast message={toast.message} tone={toast.tone} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs + 2, // matches the Email screen's top bar
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface.raised,
  },
  centeredText: {
    textAlign: 'center',
  },
  code: {
    alignSelf: 'stretch',
  },
  overlay: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
});
