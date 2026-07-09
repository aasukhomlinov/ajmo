import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CityPicker } from '@/features/city/CityPicker';
import { useT } from '@/lib/i18n';
import { theme } from '@/lib/theme';
import { Button, Header, Screen, Text } from '@/ui';

// Onboarding "What's your location?" step (frame 284:1496) — step 1 after the
// first sign-in (the gate anchors here while onboarding is unfinished). Reuses
// the shared CityPicker; the chrome differs from the in-app /city route: an H1
// prompt (no centered header title) and a Continue CTA that advances to the
// notifications-permission step. Selecting a city writes the local store
// immediately (Auth-2 moves it to the profile).
export default function OnboardingCityScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();

  return (
    <Screen>
      {/* As the flow anchor there is usually no history — hide back then. */}
      <Header
        variant="compact"
        title=""
        onBack={router.canGoBack() ? () => router.back() : undefined}
      />

      <View style={styles.body}>
        <Text variant="h1" style={styles.prompt}>
          {t('city.onboardingPrompt')}
        </Text>
        <CityPicker />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
        <Button
          label={t('common.continue')}
          fullWidth
          onPress={() => router.push('/onboarding/notifications')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: theme.spacing.lg,
  },
  prompt: {
    paddingHorizontal: theme.spacing.lg,
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
});
