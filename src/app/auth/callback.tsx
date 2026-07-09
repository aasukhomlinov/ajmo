import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/stores/auth';
import { theme } from '@/lib/theme';
import { Text } from '@/ui';

// Magic-link callback (ajmo://auth/callback). GoTrue's verify endpoint
// redirects here with the session tokens (or an error) in the URL fragment;
// this route works in BOTH gate states, so it stays outside the root-layout
// guards. useLinkingURL (NOT the deprecated useURL) reads the natively cached
// most-recent deep link, which covers cold start AND the warm case where the
// url event fired before this screen mounted — with useURL that's a race and
// the URL is silently lost. The store establishes the session, then we route
// by onboarding state; errors land on the Link-expired screen.
const BAIL_TIMEOUT_MS = 4000;

export default function AuthCallbackRoute() {
  const t = useT();
  const router = useRouter();
  const url = Linking.useLinkingURL();
  const handled = useRef(false);

  useEffect(() => {
    // Ignore unrelated URLs (e.g. the dev-launcher URL on cold start in dev).
    if (!url || !url.includes('auth/callback') || handled.current) return;
    handled.current = true;
    void (async () => {
      const result = await useAuth.getState().completeFromUrl(url);
      const { session, onboarded } = useAuth.getState();
      if (result === 'signedIn' || session) {
        // A stale link tapped while already signed in shouldn't strand the
        // user on an error screen — go into the app.
        router.replace(onboarded ? '/discover' : '/onboarding/city');
      } else {
        router.replace('/expired');
      }
    })();
  }, [url, router]);

  // Opened without a parsable link (shouldn't happen) — hand back to the gate.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!handled.current) router.replace('/');
    }, BAIL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.colors.accent.base} />
      <Text variant="body" color={theme.colors.text.secondary}>
        {t('auth.signingIn')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    backgroundColor: theme.colors.bg,
  },
});
