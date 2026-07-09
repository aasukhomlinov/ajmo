import { ArrowLeft, EnvelopeSimple } from 'phosphor-react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/stores/auth';
import { theme } from '@/lib/theme';
import { Button, IconButton, Input, Screen, Text } from '@/ui';

// Auth · Email (frame 219:1298) — email entry for the sign-in code. Validates
// locally, calls signInWithOtp via the auth store, then advances to the
// code-entry screen.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function EmailScreen() {
  const t = useT();
  const router = useRouter();
  const sendCode = useAuth((s) => s.sendCode);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<'invalid' | 'failed' | null>(null);

  const submit = async () => {
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('invalid');
      return;
    }
    setError(null);
    setSending(true);
    const sendError = await sendCode(trimmed);
    setSending(false);
    if (sendError) {
      setError('failed');
      return;
    }
    router.push('/sent');
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <IconButton
          icon={<ArrowLeft size={24} color={theme.colors.text.primary} />}
          variant="ghost"
          onPress={() => router.back()}
          accessibilityLabel={t('common.goBack')}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.copy}>
          <Text variant="h1">{t('auth.emailTitle')}</Text>
          <Text variant="body" color={theme.colors.text.secondary}>
            {t('auth.emailSubtitle')}
          </Text>
        </View>

        <Input
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            if (error) setError(null);
          }}
          placeholder={t('auth.emailPlaceholder')}
          leftIcon={<EnvelopeSimple size={20} color={theme.colors.text.secondary} />}
          error={error != null}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          autoFocus
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
        />
        {error ? (
          <Text variant="bodySmall" color={theme.colors.error}>
            {error === 'invalid' ? t('auth.emailInvalid') : t('auth.sendFailed')}
          </Text>
        ) : null}

        <Button
          label={t('auth.sendCode')}
          fullWidth
          disabled={sending}
          onPress={() => void submit()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xs + 2, // frame: button at y 56 under the ~50pt status area
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  copy: {
    gap: theme.spacing.sm,
  },
});
