import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/lib/theme';
import { Logo } from '@/ui';

// Onboarding start / splash (frame 217:1271) — the signed-out entry route.
// Holds the wordmark on bg for a beat after the native splash hides, then
// advances to the auth landing. Signed-in users never reach it: the root gate
// redirects them into the app before this route renders.
const ADVANCE_DELAY_MS = 900;

// Frame draws the logo 142pt wide; with the 98:33 wordmark ratio that is
// height 48 (the 64pt Figma box includes padding).
const LOGO_HEIGHT = 48;

export function StartScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => router.replace('/welcome'), ADVANCE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Logo height={LOGO_HEIGHT} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.bg,
  },
});
